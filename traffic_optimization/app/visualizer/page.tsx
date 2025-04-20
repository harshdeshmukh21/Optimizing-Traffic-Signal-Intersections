"use client";

import { useEffect, useState } from "react";
import React from "react";
import { ArrowLeft, BarChart2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface SignalData {
  Day: string;
  Hour: number;
  Signal_1_Green: number;
  Signal_1_Red: number;
  Signal_2_Green: number;
  Signal_2_Red: number;
  Signal_3_Green?: number;
  Signal_3_Red?: number;
  Signal_4_Green?: number;
  Signal_4_Red?: number;
  Signal_5_Green?: number;
  Signal_5_Red?: number;
  Signal_6_Green?: number;
  Signal_6_Red?: number;
  Signal_1_Timings?: string;
  Signal_2_Timings?: string;
  Signal_3_Timings?: string;
  Signal_4_Timings?: string;
  Signal_5_Timings?: string;
  Signal_6_Timings?: string;
  Avg_Queue_Length: number;
  Avg_Delay_Time: number;
  Original_Queue_Length?: number;
  Original_Delay_Time?: number;
}

interface VisualizationData {
  optimizedResults: SignalData[];
  intersectionType: string;
  fileName: string;
}

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const parseTimings = (timingString?: string) => {
  if (!timingString) return { green: 0, red: 0 };

  // Handle both "G:34|R:80" and "G:34|R:80" formats
  const greenMatch = timingString.match(/G:(\d+)/);
  const redMatch = timingString.match(/R:(\d+)/);

  return {
    green: greenMatch ? parseInt(greenMatch[1]) : 0,
    red: redMatch ? parseInt(redMatch[1]) : 0,
  };
};

export default function Visualizer() {
  const [chartData, setChartData] = useState<SignalData[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intersectionType, setIntersectionType] = useState<string>("Four-Way");
  const [fileName, setFileName] = useState<string>("traffic_data.csv");
  const router = useRouter();

  useEffect(() => {
    const loadData = () => {
      try {
        const savedData = localStorage.getItem("visualizationData");
        if (savedData) {
          const parsedData: VisualizationData = JSON.parse(savedData);
          // Process the data to extract original timings
          const processedData = parsedData.optimizedResults.map((data) => {
            const processed: any = { ...data };

            // Extract original timings from the Timings fields if they exist
            for (let i = 1; i <= 6; i++) {
              const timingKey = `Signal_${i}_Timings` as keyof SignalData;
              if (data[timingKey]) {
                const { green, red } = parseTimings(data[timingKey] as string);
                processed[`Signal_${i}_Original_Green`] = green;
                processed[`Signal_${i}_Original_Red`] = red;
              }
            }

            return processed as SignalData;
          });

          setChartData(processedData);
          setIntersectionType(parsedData.intersectionType);
          setFileName(parsedData.fileName);
          setError(null);
        } else {
          setError(
            "No visualization data found. Please upload and optimize a file first."
          );
        }
      } catch (err) {
        console.error("Error loading visualization data:", err);
        setError("Error loading visualization data.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleNextDay = () => {
    setCurrentDayIndex((prevIndex) => (prevIndex + 1) % days.length);
  };

  const handlePreviousDay = () => {
    setCurrentDayIndex(
      (prevIndex) => (prevIndex - 1 + days.length) % days.length
    );
  };

  const navigateToUpload = () => {
    router.push("/optimize");
  };

  const filteredData = chartData.filter(
    (data) => data.Day === days[currentDayIndex]
  );

  const signalCount =
    intersectionType === "T-Junction"
      ? 3
      : intersectionType === "Diamond"
      ? 6
      : 4;

  const renderSignalGreenComparison = (signalNumber: number) => {
    return (
      <Card key={`signal-${signalNumber}-green`}>
        <CardHeader>
          <CardTitle>Signal {signalNumber} Green Time Comparison</CardTitle>
          <CardDescription>
            Current vs Optimized green times for Signal {signalNumber} on{" "}
            {days[currentDayIndex]}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filteredData}
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
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
                  value: "Time (seconds)",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle" },
                }}
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey={`Signal_${signalNumber}_Original_Green`}
                fill="#8884d8"
                name={`Original Green`}
                opacity={0.7}
              />
              <Bar
                dataKey={`Signal_${signalNumber}_Green`}
                fill="#82ca9d"
                name={`Optimized Green`}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const renderSignalRedComparison = (signalNumber: number) => {
    return (
      <Card key={`signal-${signalNumber}-red`}>
        <CardHeader>
          <CardTitle>Signal {signalNumber} Red Time Comparison</CardTitle>
          <CardDescription>
            Current vs Optimized red times for Signal {signalNumber} on{" "}
            {days[currentDayIndex]}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filteredData}
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
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
                  value: "Time (seconds)",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle" },
                }}
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey={`Signal_${signalNumber}_Original_Red`}
                fill="#ffc658"
                name={`Original Red`}
                opacity={0.7}
              />
              <Bar
                dataKey={`Signal_${signalNumber}_Red`}
                fill="#ff8042"
                name={`Optimized Red`}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
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
            <div className="grid grid-cols-1 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Dataset Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    Active
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fileName} ({intersectionType}, {days[currentDayIndex]})
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Signal Timing Comparisons in 2-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: signalCount }).map((_, i) => {
              const signalNumber = i + 1;
              return (
                <React.Fragment key={`signal-${signalNumber}`}>
                  {renderSignalGreenComparison(signalNumber)}
                  {renderSignalRedComparison(signalNumber)}
                </React.Fragment>
              );
            })}
          </div>

          {/* Average Queue Length Comparison (unchanged) */}
          <Card>
            <CardHeader>
              <CardTitle>Average Queue Length Comparison</CardTitle>
              <CardDescription>
                Comparing original and optimized average queue lengths for{" "}
                {days[currentDayIndex]}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {filteredData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
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
                        value: "Queue Length",
                        angle: -90,
                        position: "insideLeft",
                        style: { textAnchor: "middle" },
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
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <BarChart2 className="h-12 w-12 text-gray-300" />
                  <p className="text-gray-500">No data to display</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Average Delay Time Comparison (unchanged) */}
          <Card>
            <CardHeader>
              <CardTitle>Average Delay Time Comparison</CardTitle>
              <CardDescription>
                Comparing original and optimized average delay times for{" "}
                {days[currentDayIndex]}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {filteredData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
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
                        value: "Delay Time (seconds)",
                        angle: -90,
                        position: "insideLeft",
                        style: { textAnchor: "middle" },
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
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <BarChart2 className="h-12 w-12 text-gray-300" />
                  <p className="text-gray-500">No data to display</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center gap-4">
            <Button variant="outline" onClick={handlePreviousDay}>
              Previous Day
            </Button>
            <Button variant="outline" onClick={handleNextDay}>
              Next Day
            </Button>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
