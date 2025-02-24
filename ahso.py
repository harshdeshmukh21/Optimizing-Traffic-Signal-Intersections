from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import numpy as np
import pandas as pd
import os

app = Flask(__name__)
CORS(app)  # Add this line to enable CORS

class TrafficSignalOptimizer:
    def __init__(self, intersection_type, dataset):
        self.intersection_type = intersection_type
        self.dataset = dataset
        self.peak_hours, self.non_peak_hours = self.detect_peak_hours()
        self.adaptive_weights = self.initialize_weights()

    def detect_peak_hours(self):
        hourly_traffic = self.dataset.groupby("Hour")["Total_Vehicles"].mean()
        threshold = np.percentile(hourly_traffic, 75)
        peak_hours = hourly_traffic[hourly_traffic > threshold].index.tolist()
        non_peak_hours = hourly_traffic[hourly_traffic <= threshold].index.tolist()
        return peak_hours, non_peak_hours

    def initialize_weights(self):
        base_weights = {
            "Four-Way": [0.4, 0.3, 0.2, 0.1],
            "T-Junction": [0.3, 0.4, 0.2],
            "Roundabout": [0.25, 0.25, 0.25, 0.25],
            "Diamond": [0.35, 0.35, 0.2, 0.1]
        }
        return base_weights[self.intersection_type]

    def optimize_signal_timings(self):
        optimized_data = []

        for hour in range(24):
            if hour in self.peak_hours:
                weights = [min(w * 1.3, 0.6) for w in self.adaptive_weights]
            elif hour in self.non_peak_hours:
                weights = [max(w * 0.7, 0.1) for w in self.adaptive_weights]
            else:
                weights = self.adaptive_weights

            total_cycle = 120 if hour in self.peak_hours else 90
            green_times = [round(w * total_cycle) for w in weights]

            total_vehicles = self.dataset[self.dataset["Hour"] == hour]["Total_Vehicles"].mean()
            avg_queue_length = round(total_vehicles * np.random.uniform(0.01, 0.04), 2)
            avg_delay_time = round(total_vehicles * np.random.uniform(0.02, 0.05), 2)

            data_row = {
                "Hour": hour,
                **{f"Signal_{i+1}_Green": green for i, green in enumerate(green_times)},
                "Avg_Queue_Length": avg_queue_length,
                "Avg_Delay_Time": avg_delay_time
            }
            optimized_data.append(data_row)

        optimized_df = pd.DataFrame(optimized_data)
        output_file = f"optimized_{self.intersection_type.lower()}_signals.csv"
        optimized_df.to_csv(output_file, index=False)

        return optimized_df, output_file

    def adjust_night_cycle(self):
        nighttime_traffic = self.dataset[self.dataset["Hour"].between(22, 5)]["Total_Vehicles"].mean()
        daytime_avg = self.dataset[self.dataset["Hour"].between(6, 21)]["Total_Vehicles"].mean()

        if nighttime_traffic < 0.3 * daytime_avg:
            return "Low nighttime traffic detected. Reducing cycle length to 60s."
        elif 0.3 * daytime_avg <= nighttime_traffic < 0.7 * daytime_avg:
            return "Moderate nighttime traffic detected. Adjusting cycle length to 80-100s."
        else:
            return "Nighttime traffic is similar to daytime. Keeping normal cycle length."

@app.route('/optimize', methods=['POST'])
def optimize():
    intersection_type = request.form['intersection_type']
    file = request.files['file']
    dataset = pd.read_csv(file)

    optimizer = TrafficSignalOptimizer(intersection_type, dataset)
    optimized_timings, output_file = optimizer.optimize_signal_timings()
    night_strategy = optimizer.adjust_night_cycle()

    return send_file(output_file, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)