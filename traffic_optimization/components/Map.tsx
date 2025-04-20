"use client"; // Ensures this runs only on the client side

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  GoogleMap,
  LoadScript,
  TrafficLayer,
  Marker,
  DirectionsRenderer,
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
  lat: 19.022,
  lng: 73.019,
};

const Maps = () => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedIntersections, setSelectedIntersections] = useState<
    { lat: number; lng: number }[]
  >([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [directions, setDirections] =
    useState<google.maps.DirectionsResult | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<{
    distance: string;
    duration: string;
    durationInSeconds: number;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [optimizationResult, setOptimizationResult] = useState<{
    optimized_green_times: number[];
    optimized_red_times: number[];
    estimated_delay_time: number;
    intersection_type: string;
    optimized_travel_time: number;
    time_saved: number;
  } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationError, setOptimizationError] = useState<string | null>(
    null
  );
  const [trafficCondition, setTrafficCondition] = useState("red");
  const [currentHour, setCurrentHour] = useState(0);

  // Form state for intersection configuration
  const [intersectionType, setIntersectionType] = useState("fourway");
  const [greenTimings, setGreenTimings] = useState({
    timing1: "30",
    timing2: "30",
    timing3: "30",
    timing4: "30",
  });
  const [redTimings, setRedTimings] = useState({
    timing1: "30",
    timing2: "30",
    timing3: "30",
    timing4: "30",
  });

  // Reference to DirectionsService
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(
    null
  );

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    // Initialize directions service
    directionsServiceRef.current = new google.maps.DirectionsService();
  }, []);

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const latLng = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      };

      setSelectedIntersections((prev) => {
        // Add new intersection if less than 2 are selected
        if (prev.length < 2) {
          const newIntersections = [...prev, latLng];
          if (newIntersections.length === 2) {
            calculateRoute(newIntersections[0], newIntersections[1]);
          } else {
            setDirections(null);
            setDistanceInfo(null);
          }
          return newIntersections;
        }
        // Replace the last selected intersection if 2 are already selected
        else {
          const newIntersections = [prev[0], latLng];
          calculateRoute(newIntersections[0], newIntersections[1]);
          return newIntersections;
        }
      });
    }
  }, []);

  const calculateRoute = (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ) => {
    if (!directionsServiceRef.current) return;

    const request = {
      origin: origin,
      destination: destination,
      travelMode: google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: true,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS,
      },
    };

    directionsServiceRef.current.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        // Select the route with the shortest duration
        if (!result || !result.routes) {
          console.error("No routes found in the result.");
          return;
        }
        const bestRoute = result.routes.reduce((prev, current) =>
          (prev.legs[0]?.duration?.value ?? Infinity) <
          (current.legs[0]?.duration?.value ?? Infinity)
            ? prev
            : current
        );

        setDirections({
          ...result,
          routes: [bestRoute], // Only keep the best route
        });

        // Extract distance and duration information
        const route = bestRoute;
        if (route && route.legs[0]) {
          const durationInSeconds = route.legs[0].duration?.value || 0;

          setDistanceInfo({
            distance: route.legs[0].distance?.text || "",
            duration: route.legs[0].duration?.text || "",
            durationInSeconds: durationInSeconds,
          });

          // Set current time and hour
          const now = new Date();
          setCurrentTime(now.toLocaleTimeString());
          setCurrentHour(now.getHours());

          // Determine traffic condition based on duration and distance
          const distanceInKm =
            parseFloat(
              (route.legs[0].distance?.text || "").replace(" km", "")
            ) ||
            parseFloat(
              (route.legs[0].distance?.text || "")
                .replace(",", "")
                .replace(" m", "")
            ) / 1000;
          const speed = distanceInKm / (durationInSeconds / 3600);

          if (speed < 20) {
            setTrafficCondition("red");
          } else if (speed < 40) {
            setTrafficCondition("yellow");
          } else {
            setTrafficCondition("green");
          }

          // Open the drawer with the information
          setIsDrawerOpen(true);
          setOptimizationResult(null); // Clear previous optimization results
          setOptimizationError(null);
        }
      } else {
        console.error("Directions request failed due to " + status);
      }
    });
  };

  const handleOptimizeIntersection = async () => {
    if (!distanceInfo) {
      console.error("Distance information not available.");
      return;
    }

    setIsOptimizing(true);
    setOptimizationError(null);

    // Filter out empty timings based on intersection type
    const greenTimesArray = Object.values(greenTimings)
      .slice(0, intersectionType === "threeway" ? 3 : 4)
      .map(Number);

    const redTimesArray = Object.values(redTimings)
      .slice(0, intersectionType === "threeway" ? 3 : 4)
      .map(Number);

    try {
      const response = await fetch("http://localhost:5001/optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          color: trafficCondition,
          green_times: greenTimesArray,
          red_times: redTimesArray,
          intersection_type:
            intersectionType === "fourway"
              ? "Four-Way"
              : intersectionType === "threeway"
              ? "T-Junction"
              : intersectionType === "diamond"
              ? "Diamond"
              : "Roundabout",
          current_hour: currentHour,
          current_travel_time: distanceInfo.durationInSeconds,
          current_distance: distanceInfo.distance,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      setOptimizationResult(data);
    } catch (error: any) {
      console.error("Optimization error:", error);
      setOptimizationError(error.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGreenTimingChange = (timingId: string, value: string) => {
    setGreenTimings((prev) => ({
      ...prev,
      [timingId]: value,
    }));
  };

  const handleRedTimingChange = (timingId: string, value: string) => {
    setRedTimings((prev) => ({
      ...prev,
      [timingId]: value,
    }));
  };

  const resetSelections = () => {
    setSelectedIntersections([]);
    setDirections(null);
    setDistanceInfo(null);
    setIsDrawerOpen(false);
    setOptimizationResult(null);
    setOptimizationError(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins > 0 ? `${mins} min ` : ""}${
      secs > 0 ? `${secs} sec` : ""
    }`.trim();
  };

  const parseDurationToSeconds = (duration: string): number => {
    // Handle formats like "1 hour 15 mins" or "45 mins" or "30 secs"
    let totalSeconds = 0;

    // Extract hours
    const hourMatch = duration.match(/(\d+)\s*hour/);
    if (hourMatch) {
      totalSeconds += parseInt(hourMatch[1]) * 3600;
    }

    // Extract minutes
    const minMatch = duration.match(/(\d+)\s*min/);
    if (minMatch) {
      totalSeconds += parseInt(minMatch[1]) * 60;
    }

    // Extract seconds
    const secMatch = duration.match(/(\d+)\s*sec/);
    if (secMatch) {
      totalSeconds += parseInt(secMatch[1]);
    }

    return totalSeconds;
  };

  const calculateTimeSaved = () => {
    if (!distanceInfo || !optimizationResult) return "No time saved";

    // Parse current duration to seconds
    const currentSeconds = parseDurationToSeconds(distanceInfo.duration);
    const optimizedSeconds = optimizationResult.optimized_travel_time;

    if (currentSeconds <= optimizedSeconds) return "No time saved";

    const savedSeconds = currentSeconds - optimizedSeconds;
    return formatTime(savedSeconds);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Button onClick={resetSelections} variant="outline">
          Clear Selection
        </Button>
      </div>

      <LoadScript
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
        libraries={["places", "geometry"]}
      >
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={initialCenter}
          zoom={15}
          onLoad={onMapLoad}
          onClick={handleMapClick}
        >
          <TrafficLayer />

          {selectedIntersections.map((position, index) => (
            <Marker
              key={`${position.lat}-${position.lng}`}
              position={position}
              label={index === 0 ? "A" : "B"}
            />
          ))}

          {directions && <DirectionsRenderer directions={directions} />}
        </GoogleMap>
      </LoadScript>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="sticky top-0 bg-background z-10">
            <DrawerTitle>Intersection Configuration</DrawerTitle>
            <DrawerDescription>
              Configure traffic signal timings for the selected intersections
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4 overflow-y-auto">
            {distanceInfo && (
              <div className="mb-6 space-y-2">
                <div className="flex justify-between">
                  <Badge variant="outline">Distance</Badge>
                  <span>{distanceInfo.distance}</span>
                </div>
                <div className="flex justify-between">
                  <Badge variant="outline">Current Time</Badge>
                  <span>{currentTime}</span>
                </div>
                <div className="flex justify-between">
                  <Badge variant="outline">Current Estimated Travel Time</Badge>
                  <span>{distanceInfo.duration}</span>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="font-medium">
                  Traffic Condition (Auto-detected)
                </h3>
                <RadioGroup
                  value={trafficCondition}
                  onValueChange={setTrafficCondition}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="red" id="red" />
                    <Label htmlFor="red">Heavy (Red)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yellow" id="yellow" />
                    <Label htmlFor="yellow">Moderate (Yellow)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="green" id="green" />
                    <Label htmlFor="green">Light (Green)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <h3 className="font-medium mb-2">Intersection Type</h3>
                <RadioGroup
                  value={intersectionType}
                  onValueChange={(value) => {
                    setIntersectionType(value);
                    // Reset optimization results when type changes
                    setOptimizationResult(null);
                    setOptimizationError(null);
                  }}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fourway" id="fourway" />
                    <Label htmlFor="fourway">Four-Way</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="threeway" id="threeway" />
                    <Label htmlFor="threeway">T-Junction</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="diamond" id="diamond" />
                    <Label htmlFor="diamond">Diamond</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="roundabout" id="roundabout" />
                    <Label htmlFor="roundabout">Roundabout</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Green Signal Timings (seconds)</h3>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="green_timing1">Direction 1</Label>
                    <Input
                      id="green_timing1"
                      type="number"
                      value={greenTimings.timing1}
                      onChange={(e) =>
                        handleGreenTimingChange("timing1", e.target.value)
                      }
                      min="10"
                      max="120"
                    />
                  </div>

                  <div>
                    <Label htmlFor="green_timing2">Direction 2</Label>
                    <Input
                      id="green_timing2"
                      type="number"
                      value={greenTimings.timing2}
                      onChange={(e) =>
                        handleGreenTimingChange("timing2", e.target.value)
                      }
                      min="10"
                      max="120"
                    />
                  </div>

                  <div>
                    <Label htmlFor="green_timing3">Direction 3</Label>
                    <Input
                      id="green_timing3"
                      type="number"
                      value={greenTimings.timing3}
                      onChange={(e) =>
                        handleGreenTimingChange("timing3", e.target.value)
                      }
                      min="10"
                      max="120"
                    />
                  </div>

                  {intersectionType !== "threeway" && (
                    <div>
                      <Label htmlFor="green_timing4">Direction 4</Label>
                      <Input
                        id="green_timing4"
                        type="number"
                        value={greenTimings.timing4}
                        onChange={(e) =>
                          handleGreenTimingChange("timing4", e.target.value)
                        }
                        min="10"
                        max="120"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Red Signal Timings (seconds)</h3>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="red_timing1">Direction 1</Label>
                    <Input
                      id="red_timing1"
                      type="number"
                      value={redTimings.timing1}
                      onChange={(e) =>
                        handleRedTimingChange("timing1", e.target.value)
                      }
                      min="10"
                      max="120"
                    />
                  </div>

                  <div>
                    <Label htmlFor="red_timing2">Direction 2</Label>
                    <Input
                      id="red_timing2"
                      type="number"
                      value={redTimings.timing2}
                      onChange={(e) =>
                        handleRedTimingChange("timing2", e.target.value)
                      }
                      min="10"
                      max="120"
                    />
                  </div>

                  <div>
                    <Label htmlFor="red_timing3">Direction 3</Label>
                    <Input
                      id="red_timing3"
                      type="number"
                      value={redTimings.timing3}
                      onChange={(e) =>
                        handleRedTimingChange("timing3", e.target.value)
                      }
                      min="10"
                      max="120"
                    />
                  </div>

                  {intersectionType !== "threeway" && (
                    <div>
                      <Label htmlFor="red_timing4">Direction 4</Label>
                      <Input
                        id="red_timing4"
                        type="number"
                        value={redTimings.timing4}
                        onChange={(e) =>
                          handleRedTimingChange("timing4", e.target.value)
                        }
                        min="10"
                        max="120"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {optimizationResult && (
              <div className="mt-8 space-y-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold">Optimization Results</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">
                        Optimized Green Timings:
                      </span>
                      <span className="font-mono">
                        {optimizationResult.optimized_green_times.join(", ")} s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">
                        Optimized Red Timings:
                      </span>
                      <span className="font-mono">
                        {optimizationResult.optimized_red_times.join(", ")} s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Intersection Type:</span>
                      <span>{optimizationResult.intersection_type}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Current Travel Time:</span>
                      <span>{distanceInfo?.duration}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">
                        Optimized Travel Time:
                      </span>
                      <span>
                        {formatTime(optimizationResult.optimized_travel_time)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Time Saved:</span>
                      <span className="text-green-600 font-semibold">
                        {calculateTimeSaved()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {optimizationError && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Optimization Error</AlertTitle>
                <AlertDescription>{optimizationError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DrawerFooter className="sticky bottom-0 bg-background border-t">
            <div className="flex gap-2 w-full">
              <Button
                onClick={handleOptimizeIntersection}
                disabled={isOptimizing}
                className="flex-1"
              >
                {isOptimizing ? (
                  <>
                    Optimizing <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  </>
                ) : (
                  "Optimize Timings"
                )}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="flex-1">
                  Cancel
                </Button>
              </DrawerClose>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Maps;
