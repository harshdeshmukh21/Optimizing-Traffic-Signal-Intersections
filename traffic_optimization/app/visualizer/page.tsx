"use client";

import { useRef, useState } from "react";
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

export default function Visualizer() {
  const [chartData, setChartData] = useState<SignalData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const formData = new FormData();
    formData.append("file", event.target.files[0]);

    try {
      const response = await fetch("/api/optimize-traffic", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload and process file");

      // 🔥 Handle file download
      const blob = await response.blob();
      const csvText = await blob.text();
      processCSV(csvText);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const processCSV = (csvText: string) => {
    const rows = csvText.split("\n").slice(1); // Skip header row
    const data: SignalData[] = rows
      .map((row) => {
        const [intersection, originalTime, optimizedTime] = row.split(",");
        return {
          intersection: intersection || "Unknown",
          originalTime: parseFloat(originalTime) || 0,
          optimizedTime: parseFloat(optimizedTime) || 0,
        };
      })
      .filter((item) => item.intersection !== ""); // Remove empty entries

    setChartData(data);
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
              <Button onClick={() => fileInputRef.current?.click()}>
                Upload CSV
              </Button>
              <BarChart width={800} height={400} data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="intersection" />
                <YAxis />
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
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
              <div className="flex gap-2 font-medium leading-none">
                Data Visualization Complete <TrendingUp className="h-4 w-4" />
              </div>
              <div className="leading-none text-muted-foreground">
                Comparing CSV data with optimized results
              </div>
            </CardFooter>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
