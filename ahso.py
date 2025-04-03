from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from tensorflow import keras
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
import tempfile
import os

app = Flask(__name__)
CORS(app)  # Enable CORS

# Adjust cycle length based on traffic conditions
def adjust_cycle_length(total_vehicles):
    if total_vehicles < 500:
        return 90  # Low traffic (night/early morning)
    elif total_vehicles > 1500:
        return 150  # High traffic (peak hours)
    else:
        return 120  # Normal traffic

# Optimize signal timings
def optimize_signal_timings(row):
    # Check which column name exists in the dataset
    total_vehicles_col = 'Total_Vehicles' if 'Total_Vehicles' in row else 'Total Vehicles'
    
    cycle_length = adjust_cycle_length(row[total_vehicles_col])
    yellow_time = 4
    
    # Handle different possible column naming formats
    green_times = []
    for i in range(3):
        signal_col = f'Signal_{i+1}_Vehicles' if f'Signal_{i+1}_Vehicles' in row else f'Signal {i+1} Vehicles'
        if signal_col in row:
            green_times.append((row[signal_col] / row[total_vehicles_col]) * (cycle_length - (yellow_time * 3)))
        else:
            # Default value if column doesn't exist
            green_times.append((1/3) * (cycle_length - (yellow_time * 3)))
    
    red_times = [cycle_length - green_times[i] - yellow_time for i in range(3)]
    return green_times + red_times

# Apply optimization to dataset
def optimize_dataset(df):
    # Standardize column names
    df = df.copy()
    
    # Rename columns for consistency if needed
    if 'Total Vehicles' in df.columns and 'Total_Vehicles' not in df.columns:
        df['Total_Vehicles'] = df['Total Vehicles']
    
    # Make sure Signal columns exist with consistent naming
    for i in range(3):
        old_col = f'Signal {i+1} Vehicles'
        new_col = f'Signal_{i+1}_Vehicles'
        
        if old_col in df.columns and new_col not in df.columns:
            df[new_col] = df[old_col]
        elif new_col not in df.columns and old_col not in df.columns:
            # Create default values if column doesn't exist (equal distribution)
            df[new_col] = df['Total_Vehicles'] / 3
    
    optimized_data = df.copy()
    
    for i, row in df.iterrows():
        try:
            optimized_times = optimize_signal_timings(row)
            for j in range(3):
                optimized_data.at[i, f'Signal_{j+1}_Green'] = round(optimized_times[j], 2)
                optimized_data.at[i, f'Signal_{j+1}_Red'] = round(optimized_times[j+3], 2)
        except Exception as e:
            print(f"Error processing row {i}: {e}")
            # Use default values if optimization fails
            for j in range(3):
                optimized_data.at[i, f'Signal_{j+1}_Green'] = 30
                optimized_data.at[i, f'Signal_{j+1}_Red'] = 60
    
    return optimized_data

# Generate synthetic traffic data using LSTM model
def generate_predicted_traffic(df):
    df = df.copy()
    
    # Ensure Total_Vehicles column exists
    if 'Total Vehicles' in df.columns and 'Total_Vehicles' not in df.columns:
        df['Total_Vehicles'] = df['Total Vehicles']
    
    try:
        scaler = MinMaxScaler()
        df_scaled = scaler.fit_transform(df[['Total_Vehicles']])
        
        # Check if we have enough data for LSTM
        if len(df_scaled) <= 7:
            # Not enough data, use simple duplication with random variation
            predicted_week = []
            for _ in range(7 * 24):
                random_idx = np.random.randint(0, len(df_scaled))
                random_factor = np.random.uniform(0.9, 1.1)
                predicted_week.append(df_scaled[random_idx][0] * random_factor)
        else:
            # Proceed with LSTM prediction
            X, y = [], []
            for i in range(len(df_scaled) - 7):
                X.append(df_scaled[i:i+7])
                y.append(df_scaled[i+7])
            X, y = np.array(X), np.array(y)
            
            model = Sequential([
                LSTM(50, return_sequences=True, input_shape=(7, 1)),
                LSTM(50),
                Dense(1)
            ])
            model.compile(optimizer='adam', loss='mse')
            model.fit(X, y, epochs=50, batch_size=8, verbose=0)
            
            last_week_data = df_scaled[-7:].reshape(1, 7, 1)
            predicted_week = []
            for _ in range(7 * 24):
                prediction = model.predict(last_week_data, verbose=0)[0][0]
                predicted_week.append(prediction)
                last_week_data = np.roll(last_week_data, -1, axis=1)
                last_week_data[0, -1, 0] = prediction
        
        predicted_week = scaler.inverse_transform(np.array(predicted_week).reshape(-1, 1)).flatten()
        
        # Create a new dataframe with the predictions
        if len(df) >= 7 * 24:
            new_df = df.iloc[-(7 * 24):].copy()
        else:
            # Duplicate rows if not enough data
            duplicated_rows = []
            while len(duplicated_rows) < 7 * 24:
                duplicated_rows.extend(df.to_dict('records'))
            new_df = pd.DataFrame(duplicated_rows[:7 * 24])
        
        new_df['Total_Vehicles'] = predicted_week
        
        # Make sure we have signal columns
        for i in range(3):
            signal_col = f'Signal_{i+1}_Vehicles'
            if signal_col not in new_df.columns:
                # Create with even distribution
                new_df[signal_col] = new_df['Total_Vehicles'] / 3
        
        return new_df
        
    except Exception as e:
        print(f"Error in prediction: {e}")
        # Fallback: duplicate the dataset with small random variations
        rows = []
        for _ in range(7 * 24):
            random_row = df.sample(1).iloc[0].copy()
            random_factor = np.random.uniform(0.9, 1.1)
            random_row['Total_Vehicles'] *= random_factor
            for i in range(3):
                signal_col = f'Signal_{i+1}_Vehicles'
                if signal_col in random_row:
                    random_row[signal_col] *= random_factor
            rows.append(random_row)
        
        return pd.DataFrame(rows)

@app.route('/optimize', methods=['POST'])
def optimize():
    file = request.files['file']
    
    # Create a temporary file to save the uploaded CSV
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, 'uploaded.csv')
    file.save(temp_path)
    
    # Read the uploaded dataset
    try:
        df = pd.read_csv(temp_path)
        
        # Handle column renaming for consistency
        if 'Total Vehicles' in df.columns and 'Total_Vehicles' not in df.columns:
            df['Total_Vehicles'] = df['Total Vehicles']
        
        if 'Total_Vehicles' not in df.columns:
            return jsonify({"error": "CSV file must contain 'Total_Vehicles' or 'Total Vehicles' column"}), 400
            
    except Exception as e:
        return jsonify({"error": f"Failed to read CSV file: {str(e)}"}), 400
    
    # Process and optimize data
    try:
        optimized_df = optimize_dataset(df)
        
        # Save optimized data to a CSV file
        optimized_file = os.path.join(temp_dir, "optimized_traffic_data.csv")
        optimized_df.to_csv(optimized_file, index=False)
        
        # Return the optimized CSV file for download
        return send_file(optimized_file, as_attachment=True, download_name="optimized_traffic_data.csv")
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return jsonify({"error": f"Optimization failed: {str(e)}", "details": error_details}), 500
    finally:
        # Clean up temporary files
        try:
            os.remove(temp_path)
            os.rmdir(temp_dir)
        except:
            pass

@app.route('/predict', methods=['POST'])
def predict():
    file = request.files['file']
    
    # Create a temporary file to save the uploaded CSV
    temp_dir = tempfile.mkdtemp()
    temp_path = os.path.join(temp_dir, 'uploaded.csv')
    file.save(temp_path)
    
    # Read the uploaded dataset
    try:
        df = pd.read_csv(temp_path)
        
        # Handle column renaming for consistency
        if 'Total Vehicles' in df.columns and 'Total_Vehicles' not in df.columns:
            df['Total_Vehicles'] = df['Total Vehicles']
            
        if 'Total_Vehicles' not in df.columns:
            return jsonify({"error": "CSV file must contain 'Total_Vehicles' or 'Total Vehicles' column"}), 400
            
    except Exception as e:
        return jsonify({"error": f"Failed to read CSV file: {str(e)}"}), 400
    
    # Generate predictions and optimize
    try:
        predicted_traffic_df = generate_predicted_traffic(df)
        optimized_predicted_df = optimize_dataset(predicted_traffic_df)
        
        # Save predicted and optimized data to a CSV file
        predicted_file = os.path.join(temp_dir, "predicted_optimized_traffic_data.csv")
        optimized_predicted_df.to_csv(predicted_file, index=False)
        
        # Return the predictions CSV file for download
        return send_file(predicted_file, as_attachment=True, download_name="predicted_optimized_traffic_data.csv")
    
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        return jsonify({"error": f"Prediction failed: {str(e)}", "details": error_details}), 500
    finally:
        # Clean up temporary files
        try:
            os.remove(temp_path)
            os.rmdir(temp_dir)
        except:
            pass

if __name__ == '__main__':
    app.run(debug=True)