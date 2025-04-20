from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import pandas as pd
import os
import tempfile

app = Flask(__name__)
CORS(app)  # Enable CORS for cross-origin requests

def color_to_vehicle_count(color):
    color_mapping = {"red": 60, "yellow": 40, "green": 10}
    return color_mapping.get(color.lower(), 40)  # Default to yellow if unknown

def calculate_optimized_timings(color, given_green_times, given_red_times, intersection_type):
    vehicle_count = color_to_vehicle_count(color)
    num_signals = len(given_green_times)

    # Validate number of signals based on intersection type
    if intersection_type == "Four-Way" and num_signals != 4:
        raise ValueError("Four-Way intersection requires exactly 4 signal timings")
    elif intersection_type == "T-Junction" and num_signals != 3:
        raise ValueError("T-Junction requires exactly 3 signal timings")
    elif intersection_type in ["Diamond", "Roundabout"] and num_signals != 4:
        raise ValueError(f"{intersection_type} requires exactly 4 signal timings")

    optimized_green_times = []
    optimized_red_times = []

    # Base cycle times based on intersection type
    base_cycle_times = {
        "Four-Way": 120,
        "T-Junction": 90,
        "Diamond": 110,
        "Roundabout": 100  # Typically shorter cycles for roundabouts
    }
    total_cycle_time = base_cycle_times.get(intersection_type, 100)

    # Calculate weights based on intersection type
    if intersection_type == "T-Junction":
        # For T-Junction, give more weight to the main road (first two directions)
        weights = [0.4, 0.4, 0.2]
    elif intersection_type == "Four-Way":
        # For Four-Way, balance all directions but give slightly more to busier directions
        weights = [0.3, 0.3, 0.2, 0.2]
    elif intersection_type == "Roundabout":
        # For Roundabout, equal weights with slight variation
        weights = [0.27, 0.27, 0.23, 0.23]
    else:  # Diamond
        weights = [0.25, 0.25, 0.25, 0.25]

    # Adjust weights based on traffic
    if vehicle_count > 50:  # Heavy traffic
        weights = [min(w * 1.2, 0.5) for w in weights]
    elif vehicle_count > 30:  # Moderate traffic
        weights = [w * 1.1 for w in weights]
    else:  # Light traffic
        weights = [w * 0.9 for w in weights]

    # Normalize weights
    weight_sum = sum(weights)
    normalized_weights = [w/weight_sum for w in weights]

    # Calculate green times based on weights
    available_green_time = total_cycle_time - (num_signals * 10)  # Reserve minimum red time
    optimized_green_times = [max(10, round(available_green_time * w)) for w in normalized_weights]

    # Calculate red times (minimum 10 seconds)
    optimized_red_times = []
    for i in range(num_signals):
        # For roundabouts, use shorter red times
        if intersection_type == "Roundabout":
            red_time = max(5, min(30, round(optimized_green_times[i] * 0.5)))
        else:
            # Red time is based on the sum of other directions' green times
            other_greens = sum(optimized_green_times[:i] + optimized_green_times[i+1:])
            red_time = max(10, min(60, other_greens // (num_signals - 1)))
        optimized_red_times.append(red_time)

    # Calculate estimated delay
    delay_factor = {
        "Four-Way": 1.0,
        "T-Junction": 0.8,
        "Diamond": 0.9,
        "Roundabout": 0.7  # Roundabouts typically have less delay
    }.get(intersection_type, 1.0)

    estimated_delay_time = round(
        (vehicle_count / 40) * 
        (sum(optimized_red_times) / num_signals) * 
        delay_factor
    )

    return optimized_green_times, optimized_red_times, estimated_delay_time

class TrafficSignalOptimizer:
    def __init__(self, intersection_type, dataset):
        self.intersection_type = intersection_type
        self.dataset = dataset

        # Ensure Day column exists, add if not present (default to Monday)
        if 'Day' not in self.dataset.columns:
            self.dataset['Day'] = 'Monday'

        # Convert Hour to integers if they aren't already
        self.dataset['Hour'] = self.dataset['Hour'].astype(int)

        self.peak_hours_by_day = self.detect_peak_hours()
        self.adaptive_weights = self.initialize_weights()

    def detect_peak_hours(self):
        """Detect peak hours for each day of the week"""
        peak_hours_by_day = {}
        days = sorted(self.dataset['Day'].unique(), 
                     key=lambda x: ['Monday', 'Tuesday', 'Wednesday', 
                                   'Thursday', 'Friday', 'Saturday', 
                                   'Sunday'].index(x))

        for day in days:
            day_data = self.dataset[self.dataset['Day'] == day]
            hourly_traffic = day_data.groupby('Hour')['Total_Vehicles'].mean()
            threshold = np.percentile(hourly_traffic, 75)
            
            peak_hours_by_day[day] = {
                'peak': hourly_traffic[hourly_traffic > threshold].index.tolist(),
                'non_peak': hourly_traffic[hourly_traffic <= threshold].index.tolist()
            }

        return peak_hours_by_day

    def initialize_weights(self):
        """Initialize signal timing weights based on intersection type"""
        if self.intersection_type == "Four-Way":
            return [0.3, 0.3, 0.2, 0.2]
        elif self.intersection_type == "T-Junction":
            return [0.4, 0.4, 0.2]  # More weight to main road
        elif self.intersection_type == "Diamond":
            return [0.25, 0.25, 0.25, 0.25]
        elif self.intersection_type == "Roundabout":
            return [0.27, 0.27, 0.23, 0.23]  # Slight variation for roundabouts
        else:
            return [0.25] * 4  # Default to equal weights

    def optimize_signal_timings(self):
        """Optimize signal timings for each day and hour in the dataset"""
        optimized_data = []
        days = sorted(self.dataset['Day'].unique(),
                     key=lambda x: ['Monday', 'Tuesday', 'Wednesday',
                                  'Thursday', 'Friday', 'Saturday',
                                  'Sunday'].index(x))

        for day in days:
            day_data = self.dataset[self.dataset['Day'] == day]
            day_peak_hours = self.peak_hours_by_day[day]['peak']

            for hour in range(24):
                hour_data = day_data[day_data['Hour'] == hour]
                if hour_data.empty:
                    continue

                # Adjust cycle time based on peak hours and intersection type
                if hour in day_peak_hours:
                    if self.intersection_type in ["Four-Way", "Diamond"]:
                        cycle_time = 140
                    elif self.intersection_type == "Roundabout":
                        cycle_time = 110  # Slightly longer for peak
                    else:  # T-Junction
                        cycle_time = 110
                else:
                    if self.intersection_type in ["Four-Way", "Diamond"]:
                        cycle_time = 100
                    elif self.intersection_type == "Roundabout":
                        cycle_time = 80  # Shorter for roundabouts
                    else:  # T-Junction
                        cycle_time = 80

                # Calculate green times
                green_times = [max(10, round(w * (cycle_time - len(self.adaptive_weights) * 10)))
                             for w in self.adaptive_weights]
                
                # Calculate red times
                red_times = []
                for i in range(len(self.adaptive_weights)):
                    if self.intersection_type == "Roundabout":
                        red_time = max(5, min(30, round(green_times[i] * 0.5)))
                    else:
                        other_greens = sum(green_times[:i] + green_times[i+1:])
                        red_time = max(10, min(60, other_greens // (len(self.adaptive_weights) - 1)))
                    red_times.append(red_time)

                # Calculate metrics
                total_vehicles = hour_data['Total_Vehicles'].mean()
                avg_queue_length = round(total_vehicles * np.random.uniform(0.01, 0.05), 2)
                avg_delay_time = round(total_vehicles * np.random.uniform(0.02, 0.06), 2)

                # Create result row
                data_row = {
                    "Day": day,
                    "Hour": hour,
                    **{f"Signal_{i+1}_Green": green for i, green in enumerate(green_times)},
                    **{f"Signal_{i+1}_Red": red for i, red in enumerate(red_times)},
                    "Avg_Queue_Length": avg_queue_length,
                    "Avg_Delay_Time": avg_delay_time,
                    "Total_Cycle_Time": sum(green_times) + sum(red_times)
                }
                optimized_data.append(data_row)

        # Convert to DataFrame and save
        optimized_df = pd.DataFrame(optimized_data)
        temp_dir = tempfile.gettempdir()
        output_file = os.path.join(temp_dir, f"optimized_{self.intersection_type.lower()}_signals.csv")
        optimized_df.to_csv(output_file, index=False)

        return optimized_df, output_file

@app.route('/optimize', methods=['POST'])
def optimize():
    if request.is_json:
        data = request.json

        if not data:
            return jsonify({"error": "No data provided"}), 400

        color = data.get('color')
        given_green_times = data.get('green_times')
        given_red_times = data.get('red_times')
        intersection_type = data.get('intersection_type', 'Four-Way')

        if not color or not given_green_times or not given_red_times:
            return jsonify({"error": "Missing required parameters"}), 400

        try:
            optimized_green_times, optimized_red_times, delay_time = calculate_optimized_timings(
                color, given_green_times, given_red_times, intersection_type
            )

            return jsonify({
                "optimized_green_times": optimized_green_times,
                "optimized_red_times": optimized_red_times,
                "estimated_delay_time": delay_time,
                "intersection_type": intersection_type
            })
        except ValueError as ve:
            return jsonify({"error": str(ve)}), 400
        except Exception as e:
            return jsonify({"error": f"Optimization failed: {str(e)}"}), 500

    else:
        try:
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400

            intersection_type = request.form.get('intersection_type', 'Four-Way')
            file = request.files['file']
            dataset = pd.read_csv(file)

            optimizer = TrafficSignalOptimizer(intersection_type, dataset)
            optimized_timings, output_file = optimizer.optimize_signal_timings()

            return send_file(
                output_file,
                as_attachment=True,
                download_name=f"optimized_{intersection_type.lower()}_signals.csv"
            )
        except Exception as e:
            return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)