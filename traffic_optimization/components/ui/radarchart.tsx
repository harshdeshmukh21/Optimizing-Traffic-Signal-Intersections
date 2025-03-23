import React from 'react';
import { TrendingUp } from "lucide-react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Legend } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Interface for radar chart data items
interface RadarDataItem {
  parameter: string;
  [key: string]: string | number;
}

interface TrafficRadarChartProps {
  data?: RadarDataItem[];
  title?: string;
  description?: string;
  footer?: string;
  intersectionType?: string;
}

export default function TrafficRadarChart({
  data = [],
  title = "Traffic Parameters Comparison",
  description = "Traffic Signal Parameters Analysis",
  footer = "Optimized Traffic Signal Parameters",
  intersectionType = "Four-Way"
}: TrafficRadarChartProps) {
  
  // Sample data if no data is provided
  const sampleData: RadarDataItem[] = data.length > 0 ? data : [
    { parameter: "Total_Vehicles", before: 450, after: 500 },
    { parameter: "Signal_1_Vehicles", before: 150, after: 180 },
    { parameter: "Signal_2_Vehicles", before: 120, after: 150 },
    { parameter: "Signal_3_Vehicles", before: 100, after: 120 },
    { parameter: "Signal_1_Timings", before: 30, after: 25 },
    { parameter: "Signal_2_Timings", before: 25, after: 20 },
    { parameter: "Signal_3_Timings", before: 20, after: 18 },
    { parameter: "Avg_Queue_Length", before: 12, after: 8 },
    { parameter: "Avg_Delay_Time", before: 35, after: 25 }
  ];
  
  // Calculate percentage improvement
  const calculateImprovement = () => {
    if (sampleData.length === 0) return null;
    
    let improvementSum = 0;
    let count = 0;
    
    sampleData.forEach(item => {
      const beforeValue = typeof item.before === 'number' ? item.before : parseFloat(item.before as string) || 0;
      const afterValue = typeof item.after === 'number' ? item.after : parseFloat(item.after as string) || 0;
      
      if (beforeValue > 0) {
        // For timings, queue length, and delay - lower is better
        if (item.parameter.includes('Timings') || item.parameter.includes('Queue') || item.parameter.includes('Delay')) {
          improvementSum += ((beforeValue - afterValue) / beforeValue) * 100;
        } else {
          // For vehicles - higher is better (better throughput)
          improvementSum += ((afterValue - beforeValue) / beforeValue) * 100;
        }
        count++;
      }
    });
    
    return count > 0 ? (improvementSum / count).toFixed(1) : "0.0";
  };
  
  const improvement = calculateImprovement();
  
  // Colors for the radar chart
  const beforeColor = "rgba(53, 162, 235, 0.6)";
  const afterColor = "rgba(75, 192, 192, 0.6)";
  const beforeStroke = "rgb(53, 162, 235)";
  const afterStroke = "rgb(75, 192, 192)";
  
  // Format parameter names for better display
  const formatParameter = (param: string) => {
    return param
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description} - {intersectionType} Intersection</CardDescription>
      </CardHeader>
      <CardContent className="pb-0">
        <div className="w-full h-96">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={sampleData}>
              <PolarGrid />
              <PolarAngleAxis 
                dataKey="parameter" 
                tickFormatter={formatParameter}
                tick={{ fill: '#888', fontSize: 12 }}
              />
              <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
              
              <Radar
                name="Before Optimization"
                dataKey="before"
                stroke={beforeStroke}
                fill={beforeColor}
                fillOpacity={0.6}
              />
              <Radar
                name="After Optimization"
                dataKey="after"
                stroke={afterStroke}
                fill={afterColor}
                fillOpacity={0.6}
              />
              
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-2 pt-4">
        {improvement && (
          <div className="flex items-center gap-2 text-sm font-medium">
            {parseFloat(improvement) >= 0 ? (
              <>Overall improvement: {improvement}%<TrendingUp className="h-4 w-4 text-green-500" /></>
            ) : (
              <>Overall change: {improvement}%<TrendingUp className="h-4 w-4 text-red-500 rotate-180" /></>
            )}
          </div>
        )}
        <div className="text-sm text-muted-foreground">{footer}</div>
      </CardFooter>
    </Card>
  );
}