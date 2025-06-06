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
  Signal_5_Green: string;
  Signal_5_Red: string;
  Signal_6_Green: string;
  Signal_6_Red: string;
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
  Cycle_Length?: number;
  Original_Queue_Length?: number;
  Original_Delay_Time?: number;
  Signal_1_Original_Green?: number;
  Signal_2_Original_Green?: number;
  Signal_3_Original_Green?: number;
  Signal_4_Original_Green?: number;
  Signal_1_Original_Red?: number;
  Signal_2_Original_Red?: number;
  Signal_3_Original_Red?: number;
  Signal_4_Original_Red?: number;
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
    type: "Diamond",
    description: "Bridge and a ramp highway",
    signals: 6,
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
  const [showPrediction, setShowPrediction] = useState<boolean>(false);
  const [predictionResults, setPredictionResults] = useState<
    OptimizedResult[] | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedFiles = localStorage.getItem("uploadedFiles");
    const savedResults = localStorage.getItem("optimizedResults");
    const savedPrediction = localStorage.getItem("predictionResults");
    const savedIntersection = localStorage.getItem("selectedIntersection");

    if (savedFiles) {
      try {
        const filesArray = JSON.parse(savedFiles);
        setFiles(filesArray);
      } catch (error) {
        console.error("Error parsing saved files:", error);
      }
    }

    if (savedResults) {
      try {
        setOptimizedResults(JSON.parse(savedResults));
      } catch (error) {
        console.error("Error parsing saved results:", error);
      }
    }

    if (savedPrediction) {
      try {
        setPredictionResults(JSON.parse(savedPrediction));
      } catch (error) {
        console.error("Error parsing saved prediction:", error);
      }
    }

    if (savedIntersection) {
      setSelectedIntersection(savedIntersection);
    }
  }, []);

  const parseCSV = (text: string): CSVData => {
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map((header) => header.trim());
    const rows = lines
      .slice(1)
      .map((line) => line.split(",").map((cell) => cell.trim()));
    return { headers, rows };
  };

  const prepareRadarData = (results: OptimizedResult[]) => {
    if (!results || results.length === 0) return [];

    const sampleResult = results.find((r) => r.Hour === 12) || results[0];

    const radarData = [
      {
        parameter: "Total_Vehicles",
        before: sampleResult.Total_Vehicles,
        after: sampleResult.Total_Vehicles * 0.9,
      },
      {
        parameter: "Avg_Delay_Time",
        before: sampleResult.Avg_Delay_Time,
        after: sampleResult.Avg_Delay_Time * 0.8,
      },
      {
        parameter: "Avg_Queue_Length",
        before: sampleResult.Avg_Queue_Length,
        after: sampleResult.Avg_Queue_Length * 0.85,
      },
      {
        parameter: "Signal_1_Timings",
        before:
          sampleResult.Signal_1_Original_Green || sampleResult.Signal_1_Green,
        after: sampleResult.Signal_1_Green,
      },
      {
        parameter: "Signal_2_Timings",
        before:
          sampleResult.Signal_2_Original_Green || sampleResult.Signal_2_Green,
        after: sampleResult.Signal_2_Green,
      },
      {
        parameter: "Signal_3_Timings",
        before:
          sampleResult.Signal_3_Original_Green || sampleResult.Signal_3_Green,
        after: sampleResult.Signal_3_Green,
      },
    ];

    if (selectedIntersection !== "T-Junction") {
      radarData.push({
        parameter: "Signal_4_Timings",
        before:
          sampleResult.Signal_4_Original_Green ||
          sampleResult.Signal_4_Green ||
          0,
        after: sampleResult.Signal_4_Green || 0,
      });
    }

    return radarData;
  };

  const handleFileChange = (newFiles: File[]) => {
    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    localStorage.setItem("uploadedFiles", JSON.stringify(updatedFiles));
    setOptimizedResults(null);
    setPredictionResults(null);
    setShowPrediction(false);
    onChange && onChange(newFiles);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async (predict: boolean = false) => {
    if (files.length === 0) return;

    setIsLoading(true);
    setOptimizationMessage(
      predict ? "Predicting traffic patterns..." : "Processing data..."
    );

    try {
      const formData = new FormData();
      formData.append("file", files[0]);
      formData.append("intersection_type", selectedIntersection);

      const endpoint = predict ? "/predict" : "/optimize";
      const response = await axios.post(
        `http://localhost:5002${endpoint}`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          responseType: "blob",
        }
      );

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers, rows } = parseCSV(text);

        const results = rows.map((row) => {
          const result: any = {};
          headers.forEach((header, index) => {
            const value = row[index];
            result[header] = isNaN(Number(value)) ? value : Number(value);
          });

          if (!result.Signal_1_Original_Green) {
            result.Signal_1_Original_Green =
              result.Signal_1_Timings || result.Signal_1_Green;
            result.Signal_2_Original_Green =
              result.Signal_2_Timings || result.Signal_2_Green;
            result.Signal_3_Original_Green =
              result.Signal_3_Timings || result.Signal_3_Green;
            if (result.Signal_4_Timings || result.Signal_4_Green) {
              result.Signal_4_Original_Green =
                result.Signal_4_Timings || result.Signal_4_Green;
            }
          }

          return result as OptimizedResult;
        });

        if (predict) {
          setPredictionResults(results);
          localStorage.setItem("predictionResults", JSON.stringify(results));
          setShowPrediction(true);
        } else {
          setOptimizedResults(results);
          localStorage.setItem("optimizedResults", JSON.stringify(results));

          const radarChartData = prepareRadarData(results);
          localStorage.setItem(
            "radarChartData",
            JSON.stringify(radarChartData)
          );
          localStorage.setItem("intersectionType", selectedIntersection);
          localStorage.setItem("lastUpdated", Date.now().toString());
        }

        const blob = new Blob([text], { type: "text/csv" });
        setDownloadLink(URL.createObjectURL(blob));
      };
      reader.readAsText(response.data);

      setOptimizationMessage(
        predict ? "Prediction complete!" : "Optimization complete!"
      );
    } catch (error: any) {
      console.error("Error processing file:", error);
      setOptimizationMessage(
        `Error: ${
          error.response?.data?.message || error.message || "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisualize = () => {
    localStorage.setItem("selectedIntersection", selectedIntersection);
    if (optimizedResults) {
      localStorage.setItem(
        "visualizationData",
        JSON.stringify({
          optimizedResults,
          intersectionType: selectedIntersection,
          fileName: files[0]?.name || "traffic_data.csv",
        })
      );
    }
    router.push("/visualizer");
  };

  const handleDownload = async () => {
    try {
      if (downloadLink) {
        const a = document.createElement("a");
        a.href = downloadLink;
        a.download = showPrediction
          ? "predicted_optimized_traffic_data.csv"
          : "optimized_traffic_data.csv";
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
    setPredictionResults(null);
    setShowPrediction(false);
    setDownloadLink(null);
    setOptimizationMessage("");
    localStorage.removeItem("uploadedFiles");
    localStorage.removeItem("optimizedResults");
    localStorage.removeItem("predictionResults");
    localStorage.removeItem("selectedIntersection");
    localStorage.removeItem("radarChartData");
    localStorage.removeItem("intersectionType");
  };

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: true,
    onDrop: (acceptedFiles) => handleFileChange(acceptedFiles),
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

  const renderResultsTable = (
    results: OptimizedResult[] | null,
    isPrediction: boolean = false
  ) => {
    if (!results) return null;

    const filteredResults = results.filter(
      (result) => result.Day === selectedDay
    );

    const signalCount =
      selectedIntersection === "T-Junction"
        ? 3
        : selectedIntersection === "Diamond"
        ? 6
        : 4;

    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-center">
          {isPrediction ? "Predicted" : "Optimized"} Results for {selectedDay}
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
                {Array.from({ length: signalCount }).map((_, i) => (
                  <React.Fragment key={i}>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Signal {i + 1} Green
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Signal {i + 1} Red
                    </th>
                  </React.Fragment>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cycle Length
                </th>
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
                  {signalCount > 3 && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.Signal_4_Green || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.Signal_4_Red || "N/A"}
                      </td>
                    </>
                  )}
                  {signalCount > 4 && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.Signal_5_Green || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.Signal_5_Red || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.Signal_6_Green || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {result.Signal_6_Red || "N/A"}
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Cycle_Length || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Avg_Queue_Length?.toFixed(2) || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {result.Avg_Delay_Time?.toFixed(2) || "N/A"}
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
              onClick={() => {
                setSelectedIntersection(intersection.type);
                setOptimizedResults(null);
                setPredictionResults(null);
              }}
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
                {intersection.description} ({intersection.signals} signals)
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

        {files.length > 0 && !optimizedResults && !predictionResults && (
          <div className="flex flex-col items-center mt-4 space-y-4">
            <button
              onClick={() => handleUpload(false)}
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
            <button
              onClick={() => handleUpload(true)}
              disabled={isLoading}
              className="px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <IconLoader2 className="animate-spin" size={18} />
                  <span>Predicting...</span>
                </>
              ) : (
                <>
                  Predict Next Week
                  <span className="h-4 w-4 ml-2">🔮</span>
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

        {optimizedResults && renderResultsTable(optimizedResults)}
        {showPrediction &&
          predictionResults &&
          renderResultsTable(predictionResults, true)}

        {(optimizedResults || predictionResults) && (
          <div className="flex justify-center mt-8 space-x-4">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
            >
              <span className="h-4 w-4">↓</span>
              Download {showPrediction ? "Predicted" : "Optimized"} Results
            </button>
            <button
              onClick={handleVisualize}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
            >
              <span className="h-4 w-4">📊</span>
              Visualize Data
            </button>
            {showPrediction && (
              <button
                onClick={() => {
                  setShowPrediction(false);
                  setPredictionResults(null);
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200 flex items-center gap-2"
              >
                <span className="h-4 w-4">←</span>
                Show Optimized Data
              </button>
            )}
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
