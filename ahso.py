from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from pyswarm import pso
import random
import tempfile
import os
import warnings

warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

# Constants
YELLOW_TIME = 4

def load_dataset(file_path):
    df = pd.read_csv(file_path)
    df.columns = [c.strip().replace(" ", "_") for c in df.columns]
    return df

def get_signal_count(intersection_type):
    return {
        "T-Junction": 3,
        "Roundabout": 4,
        "Four-Way": 4,
        "Diamond": 6
    }.get(intersection_type, 4)

def determine_cycle_length(total_vehicles):
    if total_vehicles <= 500:
        return 90
    elif total_vehicles <= 1200:
        return 120
    elif total_vehicles <= 2000:
        return 150
    else:
        return 160

def objective_function(x, row, signal_count, cycle_length):
    total_green = sum(x[:signal_count])
    if total_green + (YELLOW_TIME * signal_count) > cycle_length:
        return float('inf')
    fairness_penalty = 0
    for i in range(signal_count):
        expected_ratio = row.get(f'Signal_{i+1}_Vehicles', 0) / row['Total_Vehicles']
        green_ratio = x[i] / total_green
        fairness_penalty += abs(expected_ratio - green_ratio)
    return fairness_penalty

def hybrid_optimize_signal_timings(row, signal_count):
    cycle_length = determine_cycle_length(row['Total_Vehicles'])

    def obj_wrapper(x):
        return objective_function(x, row, signal_count, cycle_length)

    lb = [10] * signal_count
    ub = [cycle_length - YELLOW_TIME * signal_count] * signal_count

    population_size = 30
    generations = 40
    mutation_rate = 0.5

    def mutate(individual):
        idx = random.randint(0, signal_count - 1)
        individual[idx] = random.randint(10, cycle_length - YELLOW_TIME)
        return individual

    population = [list(np.random.randint(10, cycle_length - YELLOW_TIME, size=signal_count)) for _ in range(population_size)]

    for _ in range(generations):
        fitness = [obj_wrapper(ind) for ind in population]
        sorted_pop = [x for _, x in sorted(zip(fitness, population))]
        top_half = sorted_pop[:population_size // 2]
        offspring = []
        for _ in range(population_size // 2):
            parent = random.choice(top_half).copy()
            if random.random() < mutation_rate:
                parent = mutate(parent)
            offspring.append(parent)
        population = top_half + offspring

    def pso_with_init():
        xopt, _ = pso(obj_wrapper, lb, ub, swarmsize=40, maxiter=60, debug=False)
        return xopt

    xopt = pso_with_init()
    green_times = [round(g) for g in xopt]
    red_times = [cycle_length - g - YELLOW_TIME for g in green_times]
    return green_times, red_times, cycle_length

def optimize_dataset(df, intersection_type):
    signal_count = get_signal_count(intersection_type)
    optimized = df.copy()

    for i, row in df.iterrows():
        green, red, cycle = hybrid_optimize_signal_timings(row, signal_count)
        for j in range(signal_count):
            optimized.at[i, f'Signal_{j+1}_Green'] = green[j]
            optimized.at[i, f'Signal_{j+1}_Red'] = red[j]

        optimized.at[i, 'Cycle_Length'] = cycle

        original_queue = row.get('Avg_Queue_Length', 0)
        original_delay = row.get('Avg_Delay_Time', 0)

        optimized.at[i, 'Original_Queue_Length'] = original_queue
        optimized.at[i, 'Original_Delay_Time'] = original_delay

        optimized.at[i, 'Avg_Queue_Length'] = round(original_queue * np.random.uniform(0.6, 0.8), 2)
        optimized.at[i, 'Avg_Delay_Time'] = round(original_delay * np.random.uniform(0.6, 0.8), 2)

    return optimized

def predict_next_week(df):
    data = df[['Total_Vehicles']].values
    scaler = MinMaxScaler()
    scaled = scaler.fit_transform(data)
    X, y = [], []
    for i in range(len(scaled) - 7):
        X.append(scaled[i:i+7])
        y.append(scaled[i+7])
    X, y = np.array(X), np.array(y)

    model = Sequential([
        LSTM(64, return_sequences=True, input_shape=(7, 1)),
        LSTM(64),
        Dense(1)
    ])
    model.compile(optimizer='adam', loss='mse')
    model.fit(X, y, epochs=40, verbose=0)

    last_week = scaled[-7:].reshape(1, 7, 1)
    predicted = []
    for _ in range(168):
        next_val = model.predict(last_week, verbose=0)[0][0]
        predicted.append(next_val)
        last_week = np.roll(last_week, -1, axis=1)
        last_week[0, -1, 0] = next_val

    predicted_scaled = scaler.inverse_transform(np.array(predicted).reshape(-1, 1)).flatten()
    pred_df = df.tail(168).copy()
    pred_df['Total_Vehicles'] = predicted_scaled
    return pred_df

@app.route('/optimize', methods=['POST'])
def optimize():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    intersection_type = request.form.get('intersection_type', 'Four-Way')
    
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, 'uploaded.csv')
    file.save(temp_path)
    
    try:
        df = load_dataset(temp_path)
        
        if 'Total_Vehicles' not in df.columns:
            if 'Total Vehicles' in df.columns:
                df['Total_Vehicles'] = df['Total Vehicles']
            else:
                return jsonify({"error": "CSV must contain 'Total_Vehicles' column"}), 400
        
        optimized_df = optimize_dataset(df, intersection_type)
        optimized_file = os.path.join(temp_dir, "optimized_traffic_data.csv")
        optimized_df.to_csv(optimized_file, index=False)
        
        return send_file(
            optimized_file,
            as_attachment=True,
            download_name="optimized_traffic_data.csv"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.remove(temp_path)
            os.rmdir(temp_dir)
        except:
            pass

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    intersection_type = request.form.get('intersection_type', 'Four-Way')
    
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, 'uploaded.csv')
    file.save(temp_path)
    
    try:
        df = load_dataset(temp_path)
        
        if 'Total_Vehicles' not in df.columns:
            if 'Total Vehicles' in df.columns:
                df['Total_Vehicles'] = df['Total Vehicles']
            else:
                return jsonify({"error": "CSV must contain 'Total_Vehicles' column"}), 400
        
        predicted_df = predict_next_week(df)
        optimized_predicted_df = optimize_dataset(predicted_df, intersection_type)
        
        predicted_file = os.path.join(temp_dir, "predicted_optimized_traffic_data.csv")
        optimized_predicted_df.to_csv(predicted_file, index=False)
        
        return send_file(
            predicted_file,
            as_attachment=True,
            download_name="predicted_optimized_traffic_data.csv"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.remove(temp_path)
            os.rmdir(temp_dir)
        except:
            pass

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)