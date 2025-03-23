import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { IconUpload, IconTrash, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";

interface CSVData {
  headers: string[];
  rows: string[][];
}

interface OptimizedResult {
  Day: string;
  Hour: number;
  Signal_1_Green: number;
  Signal_2_Green: number;
  Signal_3_Green?: number;
  Signal_4_Green?: number;
  Avg_Queue_Length: number;
  Avg_Delay_Time: number;
  Original_Queue_Length: number;
  Original_Delay_Time: number;
}

const intersectionTypes = [
  {
    type: "Four-Way",
    description: "Standard intersection with four approaches",
  },
  {
    type: "T-Junction",
    description: "Three-way intersection forming a T shape",
  },
  {
    type: "Diamond Intersection",
    description: "Bridge and a ramp highway",
  },
  {
    type: "Roundabout",
    description: "Circular intersection with multiple approaches",
  },
];

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const mainVariant = {
  initial: { x: 0, y: 0 },
  animate: { x: 20, y: -20, opacity: 0.9 },
};

const secondaryVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

export const FileUpload = ({
  onChange,
}: {
  onChange?: (files: File[]) => void;
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [csvData, setCSVData] = useState<CSVData | null>(null);
  const [optimizedResults, setOptimizedResults] = useState<OptimizedResult[] | null>(null);
  const [selectedIntersection, setSelectedIntersection] = useState<string>("Four-Way");
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const savedIntersectionType = localStorage.getItem("selectedIntersectionType");
    const savedFileName = localStorage.getItem("uploadedFileName");
    const savedFileSize = localStorage.getItem("uploadedFileSize");
    const savedFileType = localStorage.getItem("uploadedFileType");
    const savedFileModified = localStorage.getItem("uploadedFileModified");
    const savedCsvData = localStorage.getItem("parsedCSVData");
    
    if (savedIntersectionType) {
      setSelectedIntersection(savedIntersectionType);
    }
    
    if (savedFileName && savedFileSize && savedFileType && savedFileModified) {
      const mockFile = new File([""], savedFileName, {
        type: savedFileType,
        lastModified: parseInt(savedFileModified)
      });
      
      Object.defineProperty(mockFile, 'size', {
        value: parseInt(savedFileSize),
        writable: false
      });
      
      setFiles([mockFile]);
    }
    
    if (savedCsvData) {
      setCSVData(JSON.parse(savedCsvData));
      
      const rawCsvData = localStorage.getItem("optimizedCSVData");
      if (rawCsvData) {
        const blob = new Blob([rawCsvData], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        setDownloadLink(url);
      }
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

  const handleFileChange = (newFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
    setCSVData(null);
    setDownloadLink(null);
    onChange && onChange(newFiles);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    const formData = new FormData();
    formData.append("intersection_type", selectedIntersection);
    formData.append("file", files[0]);

    try {
      const response = await fetch("http://127.0.0.1:5000/optimize", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        setDownloadLink(url);

        const text = await blob.text();
        const parsedData = parseCSV(text);
        setCSVData(parsedData);

        // Read the original dataset to get the original values
        const originalFileText = await files[0].text();
        const originalParsedData = parseCSV(originalFileText);

        // Parse the optimized results and map original values
        const results = text.split("\n").slice(1).map((line) => {
          const values = line.split(",");
          const original = originalParsedData.rows.find(
            (row) => row[0] === values[0] && parseInt(row[1]) === parseInt(values[1])
          );

          return {
            Day: values[0],
            Hour: parseInt(values[1]),
            Signal_1_Green: parseInt(values[2]),
            Signal_2_Green: parseInt(values[3]),
            Signal_3_Green: values[4] ? parseInt(values[4]) : undefined,
            Signal_4_Green: values[5] ? parseInt(values[5]) : undefined,
            Avg_Queue_Length: parseFloat(values[6]), // Optimized Queue Length
            Avg_Delay_Time: parseFloat(values[7]) || 0, // Optimized Delay Time
            Original_Queue_Length: original ? parseFloat(original[6]) : 0, // Original Queue Length
            Original_Delay_Time: original ? parseFloat(original[7]) : 0, // Original Delay Time
          };
        });

        setOptimizedResults(results);

        // Save the results to localStorage
        localStorage.setItem("optimizedCSVData", JSON.stringify(results));
        localStorage.setItem("parsedCSVData", JSON.stringify(parsedData));
        localStorage.setItem("selectedIntersectionType", selectedIntersection);
        
        localStorage.setItem("uploadedFileName", files[0].name);
        localStorage.setItem("uploadedFileSize", files[0].size.toString());
        localStorage.setItem("uploadedFileType", files[0].type);
        localStorage.setItem("uploadedFileModified", files[0].lastModified.toString());
      } else {
        console.error("Failed to upload file");
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const handleRemoveDataset = () => {
    setFiles([]);
    setCSVData(null);
    setDownloadLink(null);
    setOptimizedResults(null);
    
    localStorage.removeItem("optimizedCSVData");
    localStorage.removeItem("parsedCSVData");
    localStorage.removeItem("selectedIntersectionType");
    localStorage.removeItem("uploadedFileName");
    localStorage.removeItem("uploadedFileSize");
    localStorage.removeItem("uploadedFileType");
    localStorage.removeItem("uploadedFileModified");
  };

  const { getRootProps, isDragActive } = useDropzone({
    multiple: false,
    noClick: true,
    onDrop: handleFileChange,
    onDropRejected: (error) => {
      console.log(error);
    },
  });

  const handleNextDay = () => {
    setCurrentDayIndex((prevIndex) => (prevIndex + 1) % dayNames.length);
    setSelectedDay(dayNames[(currentDayIndex + 1) % dayNames.length]);
  };

  const handlePreviousDay = () => {
    setCurrentDayIndex((prevIndex) => (prevIndex - 1 + dayNames.length) % dayNames.length);
    setSelectedDay(dayNames[(currentDayIndex - 1 + dayNames.length) % dayNames.length]);
  };

  const renderResultsTable = () => {
    if (!optimizedResults) return null;

    const filteredResults = optimizedResults.filter((result) => result.Day === selectedDay);

    return (
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-center text-neutral-800 dark:text-neutral-200">
          Optimized Results for {selectedDay}
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-neutral-800 rounded-lg overflow-hidden">
            <thead className="bg-gray-50 dark:bg-neutral-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Day
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Hour
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Signal 1 Green
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Signal 2 Green
                </th>
                {selectedIntersection === "Four-Way" || selectedIntersection === "Diamond" ? (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Signal 3 Green
                  </th>
                ) : null}
                {selectedIntersection === "Four-Way" ? (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Signal 4 Green
                  </th>
                ) : null}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Avg Queue Length
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Avg Delay Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-neutral-600">
              {filteredResults.map((result, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {result.Day}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {result.Hour}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {result.Signal_1_Green}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {result.Signal_2_Green}
                  </td>
                  {selectedIntersection === "Four-Way" || selectedIntersection === "Diamond" ? (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {result.Signal_3_Green}
                    </td>
                  ) : null}
                  {selectedIntersection === "Four-Way" ? (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {result.Signal_4_Green}
                    </td>
                  ) : null}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {result.Avg_Queue_Length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {result.Avg_Delay_Time}
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
    <div className="w-full max-w-6xl mx-auto px-4 -mt-8">
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-neutral-800 dark:text-neutral-200 mt-4">
          Select Intersection Type
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {intersectionTypes.map((intersection) => (
            <div
              key={intersection.type}
              className={`
                p-4 rounded-lg cursor-pointer transition-all duration-200
                border-2 
                ${
                  selectedIntersection === intersection.type
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700"
                }
              `}
              onClick={() => setSelectedIntersection(intersection.type)}
            >
              <div className="flex items-center space-x-2">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                    ${
                      selectedIntersection === intersection.type
                        ? "border-blue-500"
                        : "border-gray-400"
                    }
                  `}
                >
                  {selectedIntersection === intersection.type && (
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <h3 className="font-medium text-neutral-800 dark:text-neutral-200">
                  {intersection.type}
                </h3>
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
            id="file-upload-handle"
            type="file"
            onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
            className="hidden"
          />
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
            <GridPattern />
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="relative z-20 font-sans font-bold text-neutral-700 dark:text-neutral-300 text-base">
              Upload file
            </p>
            <p className="relative z-20 font-sans font-normal text-neutral-400 dark:text-neutral-400 text-base mt-2">
              Drag or drop your files here or click to upload
            </p>
            <div className="relative w-full mt-10 max-w-xl mx-auto">
              {files.length > 0 &&
                files.map((file, idx) => (
                  <motion.div
                    key={"file" + idx}
                    layoutId={idx === 0 ? "file-upload" : "file-upload-" + idx}
                    className="relative overflow-hidden z-40 bg-white dark:bg-neutral-900 flex flex-col items-start justify-start md:h-24 p-4 mt-4 w-full mx-auto rounded-md shadow-sm"
                  >
                    <div className="flex justify-between w-full items-center gap-4">
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        layout
                        className="text-base text-neutral-700 dark:text-neutral-300 truncate max-w-xs"
                      >
                        {file.name}
                      </motion.p>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        layout
                        className="rounded-lg px-2 py-1 w-fit flex-shrink-0 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-white shadow-input"
                      >
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </motion.p>
                    </div>

                    <div className="flex text-sm md:flex-row flex-col items-start md:items-center w-full mt-2 justify-between text-neutral-600 dark:text-neutral-400">
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        layout
                        className="px-1 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800"
                      >
                        {file.type}
                      </motion.p>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        layout
                      >
                        modified{" "}
                        {new Date(file.lastModified).toLocaleDateString()}
                      </motion.p>
                    </div>
                  </motion.div>
                ))}
              {!files.length && (
                <motion.div
                  layoutId="file-upload"
                  variants={mainVariant}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                  className="relative group-hover/file:shadow-2xl z-40 bg-white dark:bg-neutral-900 flex items-center justify-center h-32 mt-4 w-full max-w-[8rem] mx-auto rounded-md shadow-[0px_10px_50px_rgba(0,0,0,0.1)]"
                >
                  {isDragActive ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-neutral-600 flex flex-col items-center"
                    >
                      Drop it
                      <IconUpload className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
                    </motion.p>
                  ) : (
                    <IconUpload className="h-4 w-4 text-neutral-600 dark:text-neutral-300" />
                  )}
                </motion.div>
              )}

              {!files.length && (
                <motion.div
                  variants={secondaryVariant}
                  className="absolute opacity-0 border border-dashed border-sky-400 inset-0 z-30 bg-transparent flex items-center justify-center h-32 mt-4 w-full max-w-[8rem] mx-auto rounded-md"
                />
              )}
            </div>
          </div>
        </motion.div>

        {files.length > 0 && !csvData && (
          <div className="flex justify-center mt-4">
            <button
              onClick={handleUpload}
              className="px-8 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors duration-200 mt-4"
            >
              Upload and Optimize
            </button>
          </div>
        )}

        {optimizedResults && renderResultsTable()}

        {downloadLink && (
          <div className="flex justify-center mt-4 space-x-4">
            <a
              href={downloadLink}
              download="optimized_signals.csv"
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors duration-200"
            >
              Download Optimized File
            </a>
            <button
              onClick={() => router.push("/visualizer")}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors duration-200"
            >
              Visualise
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
};

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