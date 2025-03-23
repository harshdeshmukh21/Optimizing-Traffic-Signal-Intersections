from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import pandas as pd
import os

app = Flask(__name__)
CORS(app)  # Enable CORS

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
        
        # Save to file
        output_file = f"optimized_{self.intersection_type.lower()}_signals.csv"
        optimized_df.to_csv(output_file, index=False)
        
        return optimized_df, output_file

    def adjust_night_cycle(self):
        """Analyze and suggest adjustments for nighttime traffic patterns"""
        results = {}
        days = sorted(self.dataset['Day'].unique(), key=lambda x: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].index(x))
        
        for day in days:
            day_data = self.dataset[self.dataset['Day'] == day]
            
            # Define nighttime hours (10 PM to 5 AM)
            nighttime_traffic = day_data[day_data['Hour'].between(22, 5)]['Total_Vehicles'].mean()
            daytime_avg = day_data[day_data['Hour'].between(6, 21)]['Total_Vehicles'].mean()
            
            if nighttime_traffic < 0.3 * daytime_avg:
                recommendation = "Low nighttime traffic detected. Reducing cycle length to 60s."
            elif 0.3 * daytime_avg <= nighttime_traffic < 0.7 * daytime_avg:
                recommendation = "Moderate nighttime traffic detected. Adjusting cycle length to 80-100s."
            else:
                recommendation = "Nighttime traffic is similar to daytime. Keeping normal cycle length."
                
            results[day] = recommendation
            
        return results

@app.route('/optimize', methods=['POST'])
def optimize():
    intersection_type = request.form['intersection_type']
    file = request.files['file']
    
    # Read the uploaded dataset
    dataset = pd.read_csv(file)
    
    # Create optimizer and process data
    optimizer = TrafficSignalOptimizer(intersection_type, dataset)
    optimized_timings, output_file = optimizer.optimize_signal_timings()
    night_strategy = optimizer.adjust_night_cycle()
    
    # Return the CSV file for download
    return send_file(output_file, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)