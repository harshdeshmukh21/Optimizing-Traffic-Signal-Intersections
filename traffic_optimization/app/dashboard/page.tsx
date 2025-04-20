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

// Define the RadarDataItem interface directly in this file since the import is failing
export interface RadarDataItem {
  parameter: string;
  before: number;
  after: number;
}

export default function Dashboard() {
  const [radarData, setRadarData] = useState<RadarDataItem[]>([]);
  const [selectedIntersection, setSelectedIntersection] =
    useState<string>("Four-Way");
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDataFromLocalStorage = () => {
      try {
        const savedRadarData = localStorage.getItem("radarChartData");
        if (savedRadarData) {
          setRadarData(JSON.parse(savedRadarData));
        }

        const savedIntersectionType = localStorage.getItem("intersectionType");
        if (savedIntersectionType) {
          setSelectedIntersection(savedIntersectionType);
        }

        setIsLoading(false);
      } catch (error) {
        console.error("Error loading data from localStorage:", error);
        setIsLoading(false);
      }
    };

    loadDataFromLocalStorage();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "radarChartData" || e.key === "intersectionType") {
        loadDataFromLocalStorage();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const calculateMetrics = () => {
    if (radarData.length === 0)
      return {
        vehicles: 0,
        delay: 0,
        queue: 0,
        improvedDelay: 0,
        improvedQueue: 0,
      };

    const vehicles =
      radarData.find((item) => item.parameter === "Total_Vehicles")?.before ||
      0;
    const delay =
      radarData.find((item) => item.parameter === "Avg_Delay_Time")?.before ||
      0;
    const queue =
      radarData.find((item) => item.parameter === "Avg_Queue_Length")?.before ||
      0;
    const improvedDelay =
      radarData.find((item) => item.parameter === "Avg_Delay_Time")?.after ||
      delay;
    const improvedQueue =
      radarData.find((item) => item.parameter === "Avg_Queue_Length")?.after ||
      queue;

    return {
      vehicles,
      delay,
      queue,
      improvedDelay,
      improvedQueue,
    };
  };

  const metrics = calculateMetrics();

  const calculateImprovements = () => {
    const improvements: Array<{
      name: string;
      before: number;
      after: number;
      change: number;
    }> = [];

    radarData
      .filter((item) => item.parameter.includes("Signal"))
      .forEach((signal) => {
        const change =
          signal.before > 0
            ? ((signal.after - signal.before) / signal.before) * 100
            : 0;

        improvements.push({
          name: signal.parameter.replace("_", " "),
          before: signal.before,
          after: signal.after,
          change,
        });
      });

    return improvements;
  };

  const signalImprovements = calculateImprovements();

  const getImprovementPercentage = (before: number, after: number) => {
    return before > 0 ? ((before - after) / before) * 100 : 0;
  };

  if (isLoading) {
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
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

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
                  {getImprovementPercentage(
                    metrics.delay,
                    metrics.improvedDelay
                  ).toFixed(1)}
                  % improvement
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
                  {getImprovementPercentage(
                    metrics.queue,
                    metrics.improvedQueue
                  ).toFixed(1)}
                  % improvement
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
                          <span>
                            Before:{" "}
                            {typeof signal.before === "number"
                              ? signal.before.toFixed(1)
                              : "0.0"}
                          </span>
                          <span>
                            After:{" "}
                            {typeof signal.after === "number"
                              ? signal.after.toFixed(1)
                              : "0.0"}
                          </span>
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
                            {getImprovementPercentage(
                              metrics.delay,
                              metrics.improvedDelay
                            ).toFixed(1)}
                            %
                          </p>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded">
                          <p className="text-xs text-muted-foreground">
                            Avg. Queue Reduction
                          </p>
                          <p className="text-lg font-semibold">
                            {getImprovementPercentage(
                              metrics.queue,
                              metrics.improvedQueue
                            ).toFixed(1)}
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
                        const change = getImprovementPercentage(
                          param.before,
                          param.after
                        );

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
                                value={param.after}
                                max={Math.max(param.before, param.after) * 1.2}
                              />
                            </div>
                            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                              <span>
                                Before:{" "}
                                {typeof param.before === "number"
                                  ? param.before.toFixed(1)
                                  : "0.0"}
                              </span>
                              <span>
                                After:{" "}
                                {typeof param.after === "number"
                                  ? param.after.toFixed(1)
                                  : "0.0"}
                              </span>
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
