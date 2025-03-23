"use client"; // Ensures this runs only on the client side

import React, { useState, useCallback } from "react";
import {
  GoogleMap,
  LoadScript,
  TrafficLayer,
  Marker,
} from "@react-google-maps/api";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const containerStyle = {
  width: "100%",
  height: "500px", // Adjust height as needed
};

const initialCenter = {
  lat: 19.0171,
  lng: 73.0175,
};

const Maps: React.FC = () => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedIntersection, setSelectedIntersection] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState<{
    optimized_green_times: number[];
    estimated_delay_time: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [intersectionType, setIntersectionType] = useState("fourway");
  const [trafficLightColor, setTrafficLightColor] = useState("green");
  const [greenTiming1, setGreenTiming1] = useState("30");
  const [greenTiming2, setGreenTiming2] = useState("30");
  const [greenTiming3, setGreenTiming3] = useState("30");

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const handleMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        const latLng = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        };
        setSelectedIntersection(latLng);
        map?.panTo(latLng); // Center the map on the selected point
        map?.setZoom(16); // Zoom in slightly

        // Reset optimization results when new intersection is selected
        setOptimizationResults(null);
        setErrorMessage(null);

        // Open the drawer to configure the intersection
        setIsDrawerOpen(true);
      }
    },
    [map]
  );

  const handleSaveIntersection = () => {
    // Here you would typically save the intersection data to your backend
    console.log("Saving intersection:", {
      location: selectedIntersection,
      type: intersectionType,
      trafficLightColor,
      greenTimings: [greenTiming1, greenTiming2, greenTiming3],
    });

    setIsDrawerOpen(false);
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setOptimizationResults(null);
    setErrorMessage(null);

    // Log the data we're about to send for debugging
    const optimizationData = {
      color: trafficLightColor,
      green_times: [
        parseInt(greenTiming1),
        parseInt(greenTiming2),
        parseInt(greenTiming3),
      ],
    };
    console.log("Sending optimization data:", optimizationData);

    try {
      // First try with JSON
      let response;

      try {
        console.log("Attempting JSON request...");
        response = await fetch("http://localhost:5001/optimize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(optimizationData),
        });
      } catch (jsonError) {
        console.error(
          "JSON request failed, trying FormData as fallback:",
          jsonError
        );

        // If JSON fails, try with FormData as fallback
        const formData = new FormData();
        formData.append("color", trafficLightColor);
        formData.append(
          "green_times",
          JSON.stringify(optimizationData.green_times)
        );

        response = await fetch("http://localhost:5001/optimize", {
          method: "POST",
          body: formData,
        });
      }

      // Log the response status and headers for debugging
      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        Object.fromEntries([...response.headers.entries()])
      );

      if (!response.ok) {
        // Try to get more details from the error response
        try {
          const errorData = await response.json();
          throw new Error(
            `Failed to optimize signal timings: ${JSON.stringify(errorData)}`
          );
        } catch (parseError) {
          throw new Error(
            `Failed to optimize signal timings (Status ${response.status})`
          );
        }
      }

      // Try to parse the response
      let data;
      try {
        data = await response.json();
        console.log("Received data:", data);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        const text = await response.text();
        throw new Error(
          `Invalid response format: ${text.substring(0, 100)}...`
        );
      }

      // Validate the response has the expected structure
      if (
        !data.optimized_green_times ||
        !Array.isArray(data.optimized_green_times)
      ) {
        throw new Error(
          `Invalid response format: Missing optimized_green_times array`
        );
      }

      if (typeof data.estimated_delay_time !== "number") {
        // If it's not a number, try to convert it
        data.estimated_delay_time = Number(data.estimated_delay_time);
        if (isNaN(data.estimated_delay_time)) {
          throw new Error(
            `Invalid response format: estimated_delay_time is not a number`
          );
        }
      }

      setOptimizationResults(data);
      console.log(
        "Optimization Complete: Traffic signal timings have been optimized."
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Error optimizing signal timings:", errorMsg);
      setErrorMessage(errorMsg);
    } finally {
      setIsOptimizing(false);
    }
  };

  const getIntersectionTypeLabel = (type: string) => {
    switch (type) {
      case "roundabout":
        return "Roundabout";
      case "t":
        return "T Intersection";
      case "fourway":
        return "Four-way Intersection";
      case "diamond":
        return "Diamond Intersection";
      default:
        return "Unknown";
    }
  };

  const getTrafficLightColorBadge = (color: string) => {
    switch (color) {
      case "red":
        return <Badge className="bg-red-500 text-white">Severe Traffic</Badge>;
      case "yellow":
        return (
          <Badge className="bg-yellow-500 text-black">Moderate Traffic</Badge>
        );
      case "green":
        return <Badge className="bg-green-500 text-white">Free Flowing</Badge>;
      default:
        return null;
    }
  };

  return (
    <div>
      <LoadScript
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={initialCenter}
          zoom={15} // Initial zoom level
          onLoad={onMapLoad}
          onClick={handleMapClick}
        >
          <TrafficLayer />

          {selectedIntersection && (
            <Marker position={selectedIntersection} title="Selected Location" />
          )}
        </GoogleMap>
      </LoadScript>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-2xl font-medium">
              Configure Intersection
            </DrawerTitle>
            <DrawerDescription>
              Set up the intersection type, traffic light color, and timing
              details
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 py-2">
            <div className="space-y-6">
              {/* Intersection Type Selection */}
              <div>
                <h3 className="text-lg font-medium mb-2">Intersection Type</h3>
                <RadioGroup
                  value={intersectionType}
                  onValueChange={setIntersectionType}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="roundabout" id="roundabout" />
                    <Label htmlFor="roundabout">Roundabout</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="t" id="t" />
                    <Label htmlFor="t">T Intersection</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fourway" id="fourway" />
                    <Label htmlFor="fourway">Four-way Intersection</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="diamond" id="diamond" />
                    <Label htmlFor="diamond">Diamond Intersection</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Traffic Light Color Selection */}
              <div>
                <h3 className="text-lg font-medium mb-2">
                  Current Traffic Conditions
                </h3>
                <RadioGroup
                  value={trafficLightColor}
                  onValueChange={setTrafficLightColor}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="green" id="green" />
                    <Label htmlFor="green">Green</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yellow" id="yellow" />
                    <Label htmlFor="yellow">Yellow</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="red" id="red" />
                    <Label htmlFor="red">Red</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Green Timings */}
              <div>
                <h3 className="text-lg font-medium mb-2">
                  Green Light Timings (seconds)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="timing1" className="mb-1 block">
                      Direction 1
                    </Label>
                    <Input
                      id="timing1"
                      type="number"
                      value={greenTiming1}
                      onChange={(e) => setGreenTiming1(e.target.value)}
                      min="5"
                      max="120"
                    />
                  </div>
                  <div>
                    <Label htmlFor="timing2" className="mb-1 block">
                      Direction 2
                    </Label>
                    <Input
                      id="timing2"
                      type="number"
                      value={greenTiming2}
                      onChange={(e) => setGreenTiming2(e.target.value)}
                      min="5"
                      max="120"
                    />
                  </div>
                  <div>
                    <Label htmlFor="timing3" className="mb-1 block">
                      Direction 3
                    </Label>
                    <Input
                      id="timing3"
                      type="number"
                      value={greenTiming3}
                      onChange={(e) => setGreenTiming3(e.target.value)}
                      min="5"
                      max="120"
                    />
                  </div>
                </div>
              </div>

              {/* Optimization Button */}
              <div className="flex justify-center">
                <Button
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                  className="w-full"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    "Optimize Signal Timings"
                  )}
                </Button>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertTitle>Optimization Error</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 text-red-700">{errorMessage}</div>
                    <div className="mt-2">
                      <p>Possible causes:</p>
                      <ul className="list-disc pl-5 mt-1">
                        <li>The Flask API (port 5001) may not be running</li>
                        <li>The API endpoint may be misconfigured</li>
                        <li>Check your network connection</li>
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Optimization Results */}
              {optimizationResults && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertTitle className="text-2xl">
                    Optimization Results
                  </AlertTitle>
                  <AlertDescription>
                    <div className="mt-2">
                      <p className="font-medium">Optimized Green Times:</p>
                      <div className="grid grid-cols-3 gap-4 mt-1">
                        {optimizationResults.optimized_green_times.map(
                          (time, index) => (
                            <div
                              key={index}
                              className="bg-white p-2 rounded border border-green-200 text-center"
                            >
                              <div className="text-sm text-gray-500">
                                Direction {index + 1}
                              </div>
                              <div className="font-bold text-green-600">
                                {time}s
                              </div>
                            </div>
                          )
                        )}
                      </div>
                      <p className="mt-3 font-medium">Estimated Delay Time:</p>
                      <p className="text-gray-700">
                        {optimizationResults.estimated_delay_time} seconds
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Maps;
