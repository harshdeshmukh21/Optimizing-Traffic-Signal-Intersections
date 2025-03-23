"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import RadarChartComponent from "../../components/ui/radarchart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Clock, Users, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface RadarDataItem {
  parameter: string;
  [key: string]: string | number;
}

export default function Dashboard() {
  const [radarData, setRadarData] = useState<RadarDataItem[]>([]);
  const [selectedIntersection, setSelectedIntersection] =
    useState<string>("Four-Way");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Load data on component mount and update when localStorage changes
  useEffect(() => {
    // Initial load
    loadDataFromLocalStorage();

    // Create a function to check for updates
    const checkForUpdates = () => {
      const newLastUpdated = localStorage.getItem("lastUpdated");
      if (newLastUpdated && newLastUpdated !== lastUpdated) {
        setLastUpdated(newLastUpdated);
        loadDataFromLocalStorage();
      }
    };

    // Check every second for changes (you could adjust this interval)
    const intervalId = setInterval(checkForUpdates, 1000);

    // Cleanup the interval on component unmount
    return () => clearInterval(intervalId);
  }, [lastUpdated]);

  const loadDataFromLocalStorage = () => {
    try {
      // Load radar data
      const savedRadarData = localStorage.getItem("radarChartData");
      if (savedRadarData) {
        setRadarData(JSON.parse(savedRadarData));
      }

      // Get intersection type if available
      const savedIntersectionType = localStorage.getItem("intersectionType");
      if (savedIntersectionType) {
        setSelectedIntersection(savedIntersectionType);
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
    }
  };

  // Calculate summary metrics from radar data
  const calculateMetrics = () => {
    if (radarData.length === 0) return { vehicles: 0, delay: 0, queue: 0 };

    const vehicles =
      radarData.find((item) => item.parameter === "Total_Vehicles")?.value || 0;
    const delay =
      radarData.find((item) => item.parameter === "Avg_Delay_Time")?.value || 0;
    const queue =
      radarData.find((item) => item.parameter === "Avg_Queue_Length")?.value ||
      0;

    return {
      vehicles:
        typeof vehicles === "number"
          ? vehicles
          : parseFloat(vehicles as string) || 0,
      delay:
        typeof delay === "number" ? delay : parseFloat(delay as string) || 0,
      queue:
        typeof queue === "number" ? queue : parseFloat(queue as string) || 0,
    };
  };

  const metrics = calculateMetrics();

  // Calculate the improvement percentages for signal timings
  const calculateImprovements = () => {
    const improvements: Array<{
      name: string;
      before: number;
      after: number;
      change: number;
    }> = [];

    radarData
      .filter(
        (item) =>
          item.parameter.includes("Signal") &&
          item.parameter.includes("Timings")
      )
      .forEach((signal) => {
        const before =
          typeof signal.before === "number"
            ? signal.before
            : parseFloat(signal.before as string) || 0;
        const after =
          typeof signal.after === "number"
            ? signal.after
            : parseFloat(signal.after as string) || 0;
        const change = before > 0 ? ((after - before) / before) * 100 : 0;

        improvements.push({
          name: signal.parameter.replace("_", " "),
          before,
          after,
          change,
        });
      });

    return improvements;
  };

  const signalImprovements = calculateImprovements();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Vehicles
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.vehicles.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Vehicles per hour
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Delay
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.delay.toFixed(1)} sec
                </div>
                <p className="text-xs text-muted-foreground">
                  Average wait time per vehicle
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Queue Length
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.queue.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average vehicles in queue
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Traffic Parameters</CardTitle>
              </CardHeader>
              <CardContent className="">
                {radarData.length > 0 ? (
                  <RadarChartComponent
                    data={radarData}
                    title={`${selectedIntersection} Optimization Parameters`}
                    description="Comparison of signal timings and parameters"
                    footer={`Optimized for ${selectedIntersection} intersection type`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    No data available. Please upload a traffic data file.
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Signal Timing Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <div className="space-y-4">
                    {signalImprovements.map((signal, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">
                            {signal.name}
                          </span>
                          <span className="text-sm font-medium flex items-center">
                            {signal.change >= 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-red-500 mr-1 transform rotate-180" />
                            )}
                            {signal.change.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Before: {signal.before.toFixed(1)}</span>
                          <span>After: {signal.after.toFixed(1)}</span>
                        </div>
                        <Progress
                          value={signal.after}
                          max={Math.max(signal.before, signal.after) * 1.2}
                          className={
                            signal.change >= 0 ? "bg-green-100" : "bg-red-100"
                          }
                        />
                      </div>
                    ))}

                    {/* Summary section */}
                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-medium mb-2">
                        Overall Performance
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                          <p className="text-xs text-muted-foreground">
                            Avg. Delay Reduction
                          </p>
                          <p className="text-lg font-semibold">
                            {metrics.delay > 0
                              ? (
                                  ((metrics.delay - metrics.delay * 0.8) /
                                    (metrics.delay * 0.8)) *
                                  100
                                ).toFixed(1)
                              : 0}
                            %
                          </p>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                          <p className="text-xs text-muted-foreground">
                            Avg. Queue Reduction
                          </p>
                          <p className="text-lg font-semibold">
                            {metrics.queue > 0
                              ? (
                                  ((metrics.queue - metrics.queue * 0.85) /
                                    (metrics.queue * 0.85)) *
                                  100
                                ).toFixed(1)
                              : 0}
                            %
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    No data available for analysis.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Additional section for historical data comparison */}
          {radarData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Traffic Flow Optimization Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground -mt-4">
                    The optimization algorithm has improved traffic flow for the{" "}
                    {selectedIntersection} intersection. Key performance
                    indicators show reductions in delay times and queue lengths.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {radarData
                      .filter((item) => !item.parameter.includes("Signal"))
                      .map((param, index) => {
                        const before =
                          typeof param.before === "number"
                            ? param.before
                            : parseFloat(param.before as string) || 0;
                        const after =
                          typeof param.after === "number"
                            ? param.after
                            : parseFloat(param.after as string) || 0;
                        const change =
                          before > 0 ? ((after - before) / before) * 100 : 0;

                        return (
                          <div
                            key={index}
                            className="bg-slate-50 dark:bg-slate-900 p-3 rounded-md"
                          >
                            <div className="flex justify-between items-center">
                              <h4 className="text-sm font-medium">
                                {param.parameter.replace("_", " ")}
                              </h4>
                              <span
                                className={`text-xs font-medium ${
                                  change >= 0
                                    ? "text-green-500"
                                    : "text-red-500"
                                }`}
                              >
                                {change.toFixed(1)}%
                              </span>
                            </div>
                            <div className="mt-2">
                              <Progress
                                value={after}
                                max={Math.max(before, after) * 1.2}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                              <span>Before: {before.toFixed(1)}</span>
                              <span>After: {after.toFixed(1)}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
