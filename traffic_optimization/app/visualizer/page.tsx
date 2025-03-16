"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SignalData {
  intersection: string;
  originalTime: number;
  optimizedTime: number;
}

interface CSVData {
  headers: string[];
  rows: string[][];
}

export default function Visualizer() {
  const [chartData, setChartData] = useState<SignalData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we have data in localStorage from the FileUpload component
    try {
      const savedRawCSV = localStorage.getItem("optimizedCSVData");
      const savedParsedData = localStorage.getItem("parsedCSVData");
      
      if (savedParsedData) {
        // Use the parsed data if available
        const parsedData: CSVData = JSON.parse(savedParsedData);
        transformDataForChart(parsedData);
      } else if (savedRawCSV) {
        // Use the raw CSV if that's what we have
        processCSV(savedRawCSV);
      } else {
        setError("No optimization data found. Please upload a file.");
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Error loading optimization data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      processCSV(text);
      
      // Save to localStorage for future use
      localStorage.setItem("optimizedCSVData", text);
    } catch (error) {
      console.error("Error processing file:", error);
      setError("Error processing file. Please check the format.");
    } finally {
      setIsLoading(false);
    }
  };

  const processCSV = (csvText: string) => {
    try {
      const lines = csvText.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.trim());
      const rows = lines.slice(1).map(line => line.split(",").map(cell => cell.trim()));
      
      const parsedData: CSVData = { headers, rows };
      
      // Save the parsed structure for easier access next time
      localStorage.setItem("parsedCSVData", JSON.stringify(parsedData));
      
      transformDataForChart(parsedData);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setError("Error parsing CSV data. Please check the format.");
    }
  };

  const transformDataForChart = (parsedData: CSVData) => {
    const { headers, rows } = parsedData;
    
    // Try to identify the relevant columns
    const intersectionIndex = findColumnIndex(headers, ["intersection", "location", "signal", "name"]);
    const originalTimeIndex = findColumnIndex(headers, ["original", "current", "before", "initial"]);
    const optimizedTimeIndex = findColumnIndex(headers, ["optimized", "new", "after", "suggested"]);
    
    // If we couldn't identify the columns, make an educated guess
    const idxIntersection = intersectionIndex >= 0 ? intersectionIndex : 0;
    const idxOriginal = originalTimeIndex >= 0 ? originalTimeIndex : 1;
    const idxOptimized = optimizedTimeIndex >= 0 ? optimizedTimeIndex : 2;
    
    // Transform the data for the chart
    const data: SignalData[] = rows
      .filter(row => row.length >= Math.max(idxIntersection, idxOriginal, idxOptimized) + 1)
      .map(row => ({
        intersection: row[idxIntersection] || "Unknown",
        originalTime: parseFloat(row[idxOriginal]) || 0,
        optimizedTime: parseFloat(row[idxOptimized]) || 0
      }));
    
    if (data.length > 0) {
      setChartData(data);
      setError(null);
    } else {
      setError("No valid data found in the CSV file.");
    }
  };

  // Helper function to find column index by potential names
  const findColumnIndex = (headers: string[], possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => 
        h.toLowerCase().includes(name.toLowerCase())
      );
      if (index >= 0) return index;
    }
    return -1;
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Calculate improvement percentage
  const calculateImprovement = (): string => {
    if (chartData.length === 0) return "0%";
    
    const totalOriginal = chartData.reduce((sum, item) => sum + item.originalTime, 0);
    const totalOptimized = chartData.reduce((sum, item) => sum + item.optimizedTime, 0);
    
    if (totalOriginal === 0) return "0%";
    
    const improvementPercentage = ((totalOriginal - totalOptimized) / totalOriginal) * 100;
    return `${improvementPercentage.toFixed(2)}%`;
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Visualizer</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card>
            <CardHeader>
              <CardTitle>Green Signal Time Comparison</CardTitle>
              <CardDescription>
                Comparing original and optimized green signal durations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <p className="text-gray-500 mb-4">{error}</p>
                  <Button onClick={handleUploadClick}>
                    Upload CSV File
                  </Button>
                </div>
              ) : chartData.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <div className="mb-6 text-center">
                    <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg inline-block">
                      <span className="font-semibold">Overall Improvement: </span>
                      <span className="text-green-600 dark:text-green-400 font-bold">
                        {calculateImprovement()}
                      </span>
                    </div>
                  </div>
                  <BarChart 
                    width={800} 
                    height={400} 
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="intersection" 
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      label={{ 
                        value: 'Time (seconds)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle' }
                      }} 
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="originalTime"
                      fill="#8884d8"
                      name="Original Time"
                    />
                    <Bar
                      dataKey="optimizedTime"
                      fill="#82ca9d"
                      name="Optimized Time"
                    />
                  </BarChart>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64">
                  <p className="text-gray-500 mb-4">No data to display</p>
                  <Button onClick={handleUploadClick}>
                    Upload CSV File
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-sm">
              <div className="flex gap-2 font-medium leading-none">
                {chartData.length > 0 ? (
                  <>Data Visualization Complete <TrendingUp className="h-4 w-4" /></>
                ) : (
                  "Upload a CSV file to visualize data"
                )}
              </div>
              {chartData.length > 0 && (
                <div className="text-muted-foreground">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleUploadClick}
                  >
                    Upload Different File
                  </Button>
                </div>
              )}
            </CardFooter>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}