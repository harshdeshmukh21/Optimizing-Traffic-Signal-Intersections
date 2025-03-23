"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BarChart2 } from "lucide-react";
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
import { useRouter } from "next/navigation";

interface SignalData {
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

interface CSVData {
  headers: string[];
  rows: string[][];
}

export default function Visualizer() {
  const [chartData, setChartData] = useState<SignalData[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Function to check for storage changes
  const checkStorageChanges = () => {
    try {
      const savedParsedData = localStorage.getItem("parsedCSVData");
      
      if (!savedParsedData) {
        setChartData([]);
        setError("No optimization data found. Please upload a file.");
        return;
      }
      
      const parsedData: CSVData = JSON.parse(savedParsedData);
      transformDataForChart(parsedData);
    } catch (error) {
      console.error("Error checking storage changes:", error);
      setError("Error loading optimization data.");
    }
  };

  // Initial data loading
  useEffect(() => {
    try {
      const savedRawCSV = localStorage.getItem("optimizedCSVData");
      const savedParsedData = localStorage.getItem("parsedCSVData");

      if (savedParsedData) {
        const parsedData: CSVData = JSON.parse(savedParsedData);
        transformDataForChart(parsedData);
      } else if (savedRawCSV) {
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

  // Listen for storage events to update the visualization when dataset is removed
  useEffect(() => {
    window.addEventListener('storage', (e) => {
      if (e.key === "parsedCSVData" || e.key === null) {
        checkStorageChanges();
      }
    });

    const interval = setInterval(checkStorageChanges, 1000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkStorageChanges);
    };
  }, []);

  const processCSV = (csvText: string) => {
    try {
      const lines = csvText.trim().split("\n");
      const headers = lines[0].split(",").map(h => h.trim());
      const rows = lines.slice(1).map(line => line.split(",").map(cell => cell.trim()));

      const parsedData: CSVData = { headers, rows };
      localStorage.setItem("parsedCSVData", JSON.stringify(parsedData));
      transformDataForChart(parsedData);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setError("Error parsing CSV data. Please check the format.");
    }
  };

  const transformDataForChart = (parsedData: CSVData) => {
    const { headers, rows } = parsedData;

    const data: SignalData[] = rows.map(row => ({
      Day: row[0],
      Hour: parseInt(row[1]),
      Signal_1_Green: parseInt(row[2]),
      Signal_2_Green: parseInt(row[3]),
      Signal_3_Green: row[4] ? parseInt(row[4]) : undefined,
      Signal_4_Green: row[5] ? parseInt(row[5]) : undefined,
      Avg_Queue_Length: parseFloat(row[6]),
      Avg_Delay_Time: parseFloat(row[7]),
      Original_Queue_Length: parseFloat(row[8]) || 0,
      Original_Delay_Time: parseFloat(row[9]) || 0,
    }));

    if (data.length > 0) {
      setChartData(data);
      setError(null);
    } else {
      setError("No valid data found in the CSV file.");
    }
  };

  const handleNextDay = () => {
    setCurrentDayIndex((prevIndex) => (prevIndex + 1) % days.length);
  };

  const handlePreviousDay = () => {
    setCurrentDayIndex((prevIndex) => (prevIndex - 1 + days.length) % days.length);
  };

  const navigateToUpload = () => {
    router.push("/optimize");
  };

  const filteredData = chartData.filter((data) => data.Day === days[currentDayIndex]);

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
          <div className="ml-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={navigateToUpload}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Upload
            </Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4">
          {chartData.length > 0 && (
            <div className="grid grid-cols-1 gap-4 mb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Dataset Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Active
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Data is loaded and visualization is active
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        
          <Card>
            <CardHeader>
              <CardTitle>Green Signal Time Comparison</CardTitle>
              <CardDescription>
                Comparing original and optimized green signal durations for {days[currentDayIndex]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <BarChart2 className="h-12 w-12 text-gray-300" />
                  <p className="text-gray-500">{error}</p>
                  <Button 
                    variant="outline" 
                    onClick={navigateToUpload}
                    className="mt-2"
                  >
                    Go to Upload Page
                  </Button>
                </div>
              ) : filteredData.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <BarChart 
                    width={800} 
                    height={400} 
                    data={filteredData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="Hour" 
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
                      dataKey="Signal_1_Green"
                      fill="#8884d8"
                      name="Signal 1 Green"
                    />
                    <Bar
                      dataKey="Signal_2_Green"
                      fill="#82ca9d"
                      name="Signal 2 Green"
                    />
                  </BarChart>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <BarChart2 className="h-12 w-12 text-gray-300" />
                  <p className="text-gray-500">No data to display</p>
                  <Button 
                    variant="outline" 
                    onClick={navigateToUpload}
                    className="mt-2"
                  >
                    Go to Upload Page
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-sm">
              <div className="flex gap-2 font-medium leading-none">
                {filteredData.length > 0 ? (
                  <>Data Visualization Complete</>
                ) : (
                  "Upload a CSV file to visualize data"
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handlePreviousDay}
                >
                  Previous Day
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleNextDay}
                >
                  Next Day
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Queue Length Comparison</CardTitle>
              <CardDescription>
                Comparing original and optimized average queue lengths for {days[currentDayIndex]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredData.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <BarChart 
                    width={800} 
                    height={400} 
                    data={filteredData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="Hour" 
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      label={{ 
                        value: 'Queue Length', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle' }
                      }} 
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="Original_Queue_Length"
                      fill="#8884d8"
                      name="Original Queue Length"
                    />
                    <Bar
                      dataKey="Avg_Queue_Length"
                      fill="#82ca9d"
                      name="Optimized Queue Length"
                    />
                  </BarChart>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <BarChart2 className="h-12 w-12 text-gray-300" />
                  <p className="text-gray-500">No data to display</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-sm">
              <div className="flex gap-2 font-medium leading-none">
                {filteredData.length > 0 ? (
                  <>Data Visualization Complete</>
                ) : (
                  "Upload a CSV file to visualize data"
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handlePreviousDay}
                >
                  Previous Day
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleNextDay}
                >
                  Next Day
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Delay Time Comparison</CardTitle>
              <CardDescription>
                Comparing original and optimized average delay times for {days[currentDayIndex]}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredData.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <BarChart 
                    width={800} 
                    height={400} 
                    data={filteredData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="Hour" 
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis 
                      label={{ 
                        value: 'Delay Time (seconds)', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle' }
                      }} 
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="Original_Delay_Time"
                      fill="#8884d8"
                      name="Original Delay Time"
                    />
                    <Bar
                      dataKey="Avg_Delay_Time"
                      fill="#82ca9d"
                      name="Optimized Delay Time"
                    />
                  </BarChart>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <BarChart2 className="h-12 w-12 text-gray-300" />
                  <p className="text-gray-500">No data to display</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-sm">
              <div className="flex gap-2 font-medium leading-none">
                {filteredData.length > 0 ? (
                  <>Data Visualization Complete</>
                ) : (
                  "Upload a CSV file to visualize data"
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handlePreviousDay}
                >
                  Previous Day
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleNextDay}
                >
                  Next Day
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}