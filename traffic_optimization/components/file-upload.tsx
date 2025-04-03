import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  IconUpload,
  IconTrash,
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
} from "@tabler/icons-react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import axios from "axios";

interface CSVData {
  headers: string[];
  rows: string[][];
}

interface OptimizedResult {
  Day: string;
  Hour: number;
  Total_Vehicles: number;
  Signal_1_Vehicles: number;
  Signal_2_Vehicles: number;
  Signal_3_Vehicles: number;
  Signal_4_Vehicles?: number;
  Signal_1_Timings: number;
  Signal_2_Timings: number;
  Signal_3_Timings: number;
  Signal_4_Timings?: number;
  Avg_Queue_Length: number;
  Avg_Delay_Time: number;
  Signal_1_Green: number;
  Signal_1_Red: number;
  Signal_2_Green: number;
  Signal_2_Red: number;
  Signal_3_Green: number;
  Signal_3_Red: number;
  Signal_4_Green?: number;
  Signal_4_Red?: number;
}

const intersectionTypes = [
  {
    type: "Four-Way",
    description: "Standard intersection with four approaches",
    signals: 4,
  },
  {
    type: "T-Junction",
    description: "Three-way intersection forming a T shape",
    signals: 3,
  },
  {
    type: "Diamond Intersection",
    description: "Bridge and a ramp highway",
    signals: 4,
  },
  {
    type: "Roundabout",
    description: "Circular intersection with multiple approaches",
    signals: 4,
  },
];

const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const mainVariant = {
  initial: { x: 0, y: 0 },
  animate: { x: 20, y: -20, opacity: 0.9 },
};

const secondaryVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

export default function TrafficFileUpload({
  onChange,
}: {
  onChange?: (files: File[]) => void;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [optimizedResults, setOptimizedResults] = useState<
    OptimizedResult[] | null
  >(null);
  const [selectedIntersection, setSelectedIntersection] =
    useState<string>("Four-Way");
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [optimizationMessage, setOptimizationMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): CSVData => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((header) => header.trim());
    const rows = lines
      .slice(1)
      .map((line) => line.split(",").map((cell) => cell.trim()));
    return { headers, rows };
  };

  const handleFileChange = (newFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    setOptimizedResults(null);
    onChange && onChange(newFiles);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsLoading(true);
    setOptimizationMessage("Processing data...");

    try {
      const formData = new FormData();
      formData.append("file", files[0]);
      formData.append("intersection_type", selectedIntersection);

      const response = await axios.post(
        "http://127.0.0.1:5000/optimize",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.status < 200 || response.status >= 300) {
        throw new Error(response.data?.message || "Optimization failed");
      }

      const responseData = response.data;

      if (responseData.status === "success" && responseData.data) {
        const formattedResults = responseData.data.map((item: any) => {
          const result: OptimizedResult = {
            Day: item.Day || "Monday",
            Hour: item.Hour || 0,
            Total_Vehicles: item.Total_Vehicles || 0,
            Signal_1_Vehicles: item.Signal_1_Vehicles || 0,
            Signal_2_Vehicles: item.Signal_2_Vehicles || 0,
            Signal_3_Vehicles: item.Signal_3_Vehicles || 0,
            Signal_1_Timings: item.Signal_1_Timings || 0,
            Signal_2_Timings: item.Signal_2_Timings || 0,
            Signal_3_Timings: item.Signal_3_Timings || 0,
            Avg_Queue_Length: item.Avg_Queue_Length || 0,
            Avg_Delay_Time: item.Avg_Delay_Time || 0,
            Signal_1_Green: item.Signal_1_Green || 0,
            Signal_1_Red: item.Signal_1_Red || 0,
            Signal_2_Green: item.Signal_2_Green || 0,
            Signal_2_Red: item.Signal_2_Red || 0,
            Signal_3_Green: item.Signal_3_Green || 0,
            Signal_3_Red: item.Signal_3_Red || 0,
          };

          if (selectedIntersection !== "T-Junction") {
            result.Signal_4_Vehicles = item.Signal_4_Vehicles || 0;
            result.Signal_4_Timings = item.Signal_4_Timings || 0;
            result.Signal_4_Green = item.Signal_4_Green || 0;
            result.Signal_4_Red = item.Signal_4_Red || 0;
          }

          return result;
        });

        setOptimizedResults(formattedResults);
        setOptimizationMessage("Optimization complete!");

        // Generate CSV for download
        const headers = [
          "Day",
          "Hour",
          "Total_Vehicles",
          "Signal_1_Vehicles",
          "Signal_2_Vehicles",
          "Signal_3_Vehicles",
          ...(selectedIntersection !== "T-Junction"
            ? ["Signal_4_Vehicles"]
            : []),
          "Signal_1_Timings",
          "Signal_2_Timings",
          "Signal_3_Timings",
          ...(selectedIntersection !== "T-Junction"
            ? ["Signal_4_Timings"]
            : []),
          "Avg_Queue_Length",
          "Avg_Delay_Time",
          "Signal_1_Green",
          "Signal_1_Red",
          "Signal_2_Green",
          "Signal_2_Red",
          "Signal_3_Green",
          "Signal_3_Red",
          ...(selectedIntersection !== "T-Junction"
            ? ["Signal_4_Green", "Signal_4_Red"]
            : []),
        ];

        const csvContent = [
          headers.join(","),
          ...formattedResults.map((result: any) =>
            headers
              .map((header) => result[header as keyof OptimizedResult] || "")
              .join(",")
          ),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        setDownloadLink(URL.createObjectURL(blob));
      } else {
        throw new Error(responseData.message || "Optimization failed");
      }
    } catch (error: any) {
      console.error("Error processing file:", error);
      setOptimizationMessage(`Error: ${error.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      if (downloadLink) {
        const a = document.createElement("a");
        a.href = downloadLink;
        a.download = "optimized_traffic_data.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        throw new Error("No download link available");
      }
    } catch (error) {
      console.error("Download failed:", error);
      setOptimizationMessage("Download failed. Please try again.");
    }
  };

  const handleRemoveDataset = () => {
    setFiles([]);
    setOptimizedResults(null);
    setDownloadLink(null);
    setOptimizationMessage("");
  };

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: true,
    onDrop: handleFileChange,
    accept: { "text/csv": [".csv"] },
  });

  const handleNextDay = () => {
    setCurrentDayIndex((prev) => (prev + 1) % dayNames.length);
    setSelectedDay(dayNames[(currentDayIndex + 1) % dayNames.length]);
  };

  const handlePreviousDay = () => {
    setCurrentDayIndex(
      (prev) => (prev - 1 + dayNames.length) % dayNames.length
    );
    setSelectedDay(
      dayNames[(currentDayIndex - 1 + dayNames.length) % dayNames.length]
    );
  };

  const renderResultsTable = () => {
    if (!optimizedResults) return null;

    const filteredResults = optimizedResults.filter(
      (result) => result.Day === selectedDay
    );

    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-center">
          Optimized Results for {selectedDay}
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-neutral-800 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 dark:bg-neutral-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Hour
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Vehicles
                </th>
                {[1, 2, 3].map((signal) => (
                  <React.Fragment key={signal}>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Signal {signal} Green
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Signal {signal} Red
                    </th>
                  </React.Fragment>
                ))}
                {selectedIntersection !== "T-Junction" && (
                  <>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Signal 4 Green
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Signal 4 Red
                    </th>
                  </>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Avg Queue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Avg Delay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-neutral-600">
              {filteredResults.map((result, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Hour}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Total_Vehicles}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Signal_1_Green}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Signal_1_Red}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Signal_2_Green}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Signal_2_Red}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Signal_3_Green}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Signal_3_Red}
                  </td>
                  {selectedIntersection !== "T-Junction" && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.Signal_4_Green || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.Signal_4_Red || "N/A"}
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Avg_Queue_Length.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Avg_Delay_Time.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mt-4 space-x-4">
          <button
            onClick={handlePreviousDay}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
          >
            <IconArrowLeft size={16} />
            Previous Day
          </button>
          <button
            onClick={handleNextDay}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
          >
            Next Day
            <IconArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Select Intersection Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {intersectionTypes.map((intersection) => (
            <div
              key={intersection.type}
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                selectedIntersection === intersection.type
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700"
              }`}
              onClick={() => setSelectedIntersection(intersection.type)}
            >
              <div className="flex items-center space-x-2">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedIntersection === intersection.type
                      ? "border-blue-500"
                      : "border-gray-400"
                  }`}
                >
                  {selectedIntersection === intersection.type && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <h3 className="font-medium">{intersection.type}</h3>
              </div>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 ml-6">
                {intersection.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full" {...getRootProps()}>
        <motion.div
          onClick={handleClick}
          whileHover="animate"
          className="p-10 group/file flex rounded-lg cursor-pointer w-full relative overflow-hidden items-center justify-center border-2 border-dashed border-gray-300 dark:border-neutral-700"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center relative z-10">
            <IconUpload className="h-10 w-10 mb-4 text-blue-500" />
            <p className="font-sans font-bold text-base">
              Upload Traffic Data CSV
            </p>
            <p className="font-sans font-normal text-neutral-500 dark:text-neutral-400 text-sm mt-2">
              Drag and drop your files here or click to browse
            </p>

            <div className="relative w-full mt-10 max-w-xl mx-auto">
              {files.length > 0 &&
                files.map((file, idx) => (
                  <motion.div
                    key={idx}
                    className="relative overflow-hidden z-40 bg-white dark:bg-neutral-900 flex flex-col items-start justify-start md:h-24 p-4 mt-4 w-full mx-auto rounded-md shadow-sm"
                  >
                    <div className="flex justify-between w-full items-center gap-4">
                      <p className="text-base truncate max-w-xs">{file.name}</p>
                      <p className="rounded-lg px-2 py-1 w-fit flex-shrink-0 text-sm shadow-input">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        </motion.div>

        {files.length > 0 && !optimizedResults && (
          <div className="flex flex-col items-center mt-4">
            <button
              onClick={handleUpload}
              disabled={isLoading}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <IconLoader2 className="animate-spin" size={18} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  Analyze and Optimize
                  <span className="h-4 w-4 ml-2">↗</span>
                </>
              )}
            </button>
            {optimizationMessage && (
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {optimizationMessage}
              </p>
            )}
          </div>
        )}

        {optimizedResults && renderResultsTable()}

        {downloadLink && (
          <div className="flex justify-center mt-8 space-x-4">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
            >
              <span className="h-4 w-4">↓</span>
              Download Full Results
            </button>
            <button
              onClick={() => router.push("/visualizer")}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
            >
              <span className="h-4 w-4">📊</span>
              Visualize Data
            </button>
            <button
              onClick={handleRemoveDataset}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
            >
              <IconTrash size={16} />
              Remove Dataset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function GridPattern() {
  const columns = 41;
  const rows = 11;
  return (
    <div className="flex bg-gray-100 dark:bg-neutral-900 flex-shrink-0 flex-wrap justify-center items-center gap-x-px gap-y-px scale-105">
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: columns }).map((_, col) => {
          const index = row * columns + col;
          return (
            <div
              key={`${col}-${row}`}
              className={`w-10 h-10 flex flex-shrink-0 rounded-[2px] ${
                index % 2 === 0
                  ? "bg-gray-50 dark:bg-neutral-950"
                  : "bg-gray-50 dark:bg-neutral-950 shadow-[0px_0px_1px_3px_rgba(255,255,255,1)_inset] dark:shadow-[0px_0px_1px_3px_rgba(0,0,0,1)_inset]"
              }`}
            />
          );
        })
      )}
    </div>
  );
}
