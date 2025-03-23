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

def calculate_optimized_timings(color, given_green_times):
    vehicle_count = color_to_vehicle_count(color)
    total_cycle_time = sum(given_green_times) + len(given_green_times) * 5  # Adding buffer for transitions
    
    optimized_green_times = []
    for time in given_green_times:
        if vehicle_count > 50:
            optimized_green = min(time * np.random.uniform(1.05, 1.10), total_cycle_time * 0.5)
        elif vehicle_count > 30:
            optimized_green = time * np.random.uniform(1.05, 1.08)
        else:
            optimized_green = max(time * np.random.uniform(0.90, 0.95), 10)
        optimized_green_times.append(round(optimized_green))  # Ensure integer values
    
    # Estimate delay time based on vehicle count and cycle adjustments
    delay_time = round((vehicle_count / 60) * (sum(optimized_green_times) / len(optimized_green_times)))
    
    return optimized_green_times, delay_time

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
        days = sorted(self.dataset['Day'].unique(), key=lambda x: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].index(x))
        
        for day in days:
            # Filter data for current day
            day_data = self.dataset[self.dataset['Day'] == day]
            
            # Calculate hourly traffic for this day
            hourly_traffic = day_data.groupby('Hour')['Total_Vehicles'].mean()
            
            # Set threshold at 75th percentile for this day
            threshold = np.percentile(hourly_traffic, 75)
            
            # Identify peak and non-peak hours
            peak_hours = hourly_traffic[hourly_traffic > threshold].index.tolist()
            non_peak_hours = hourly_traffic[hourly_traffic <= threshold].index.tolist()
            
            peak_hours_by_day[day] = {
                'peak': peak_hours,
                'non_peak': non_peak_hours
            }
            
        return peak_hours_by_day

    def initialize_weights(self):
        """Initialize signal timing weights based on intersection type"""
        base_weights = {
            "Four-Way": [0.4, 0.3, 0.2, 0.1],
            "T-Junction": [0.3, 0.4, 0.2],
            "Roundabout": [0.25, 0.25, 0.25, 0.25],
            "Diamond": [0.35, 0.35, 0.2, 0.1]
        }
        return base_weights[self.intersection_type]

    def optimize_signal_timings(self):
        """Optimize signal timings for each day and hour in the dataset"""
        optimized_data = []
        days = sorted(self.dataset['Day'].unique(), key=lambda x: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].index(x))
        
        for day in days:
            day_data = self.dataset[self.dataset['Day'] == day]
            
            # Get peak hours for this specific day
            day_peak_hours = self.peak_hours_by_day[day]['peak']
            day_non_peak_hours = self.peak_hours_by_day[day]['non_peak']
            
            for hour in range(24):
                # Check if we have data for this hour
                hour_data = day_data[day_data['Hour'] == hour]
                
                if hour_data.empty:
                    continue
                
                # Adjust weights based on peak/non-peak status
                if hour in day_peak_hours:
                    weights = [min(w * 1.3, 0.6) for w in self.adaptive_weights]
                    total_cycle = 120  # Longer cycle for peak hours
                elif hour in day_non_peak_hours:
                    weights = [max(w * 0.7, 0.1) for w in self.adaptive_weights]
                    total_cycle = 90   # Standard cycle for non-peak
                else:
                    weights = self.adaptive_weights
                    total_cycle = 90   # Default cycle
                
                # Calculate green times proportionally
                green_times = [round(w * total_cycle) for w in weights]
                
                # Get traffic metrics for this day/hour
                total_vehicles = hour_data['Total_Vehicles'].mean()
                
                # Calculate performance metrics (can be refined with actual calculations)
                avg_queue_length = round(total_vehicles * np.random.uniform(0.01, 0.04), 2)
                avg_delay_time = round(total_vehicles * np.random.uniform(0.02, 0.05), 2)
                
                # Create a row for the results
                data_row = {
                    "Day": day,
                    "Hour": hour,
                    **{f"Signal_{i+1}_Green": green for i, green in enumerate(green_times)},
                    "Avg_Queue_Length": avg_queue_length,
                    "Avg_Delay_Time": avg_delay_time
                }
                optimized_data.append(data_row)
        
        # Convert results to DataFrame and save to CSV
        optimized_df = pd.DataFrame(optimized_data)
        
        # Save to file in a temporary directory
        temp_dir = tempfile.gettempdir()
        output_file = os.path.join(temp_dir, f"optimized_{self.intersection_type.lower()}_signals.csv")
        optimized_df.to_csv(output_file, index=False)
        
        return optimized_df, output_file

@app.route('/optimize', methods=['POST'])
def optimize():
    # Check if the request is JSON (direct optimization) or form data (file-based)
    if request.is_json:
        # Handle direct optimization from Maps component
        data = request.json
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        # Extract parameters from request
        color = data.get('color')
        given_green_times = data.get('green_times')
        
        # Validate inputs
        if not color or not given_green_times:
            return jsonify({"error": "Missing required parameters (color, green_times)"}), 400
        
        if not isinstance(given_green_times, list) or not all(isinstance(t, (int, float)) for t in given_green_times):
            return jsonify({"error": "green_times must be a list of numbers"}), 400
        
        # Calculate optimized timings
        optimized_times, delay_time = calculate_optimized_timings(color, given_green_times)
        
        # Return results
        return jsonify({
            "optimized_green_times": optimized_times,
            "estimated_delay_time": delay_time
        })
    
    else:
        # Handle file-based optimization
        try:
            # Check if file is included in the request
            if 'file' not in request.files:
                return jsonify({"error": "No file provided"}), 400
                
            intersection_type = request.form.get('intersection_type', 'Four-Way')
            file = request.files['file']
            
            # Read the uploaded dataset
            dataset = pd.read_csv(file)
            
            # Create optimizer and process data
            optimizer = TrafficSignalOptimizer(intersection_type, dataset)
            optimized_timings, output_file = optimizer.optimize_signal_timings()
            
            # Return the CSV file for download
            return send_file(output_file, as_attachment=True, 
                             download_name=f"optimized_{intersection_type.lower()}_signals.csv")
                             
        except Exception as e:
            return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)