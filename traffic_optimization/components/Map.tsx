"use client"; // Ensures this runs only on the client side

import React, { useState, useCallback, useRef } from "react";
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
  } | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  // Form state for intersection configuration
  const [intersectionType, setIntersectionType] = useState("fourway");
  const [greenTiming1, setGreenTiming1] = useState("30");
  const [greenTiming2, setGreenTiming2] = useState("30");
  const [greenTiming3, setGreenTiming3] = useState("30");

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
        // Only keep up to 2 intersections
        const newIntersections =
          prev.length < 2 ? [...prev, latLng] : [prev[0], latLng]; // Replace the second one if already have 2

        // If we have exactly 2 intersections, calculate route
        if (newIntersections.length === 2) {
          calculateRoute(newIntersections[0], newIntersections[1]);
        }

        return newIntersections;
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
    };

    directionsServiceRef.current.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        setDirections(result);

        // Extract distance and duration information
        const route = result?.routes[0];
        if (route && route.legs[0]) {
          setDistanceInfo({
            distance: route?.legs?.[0]?.distance?.text || "",
            duration: route.legs[0].duration?.text ?? "",
          });

          // Set current time
          const now = new Date();
          setCurrentTime(now.toLocaleTimeString());

          // Open the drawer with the information
          setIsDrawerOpen(true);
        }
      } else {
        console.error("Directions request failed due to " + status);
      }
    });
  };

  const handleSaveIntersection = () => {
    console.log("Saving intersection configuration:", {
      intersections: selectedIntersections,
      type: intersectionType,
      greenTimings: [greenTiming1, greenTiming2, greenTiming3],
      distance: distanceInfo?.distance,
      duration: distanceInfo?.duration,
    });

    setIsDrawerOpen(false);
  };

  const resetSelections = () => {
    setSelectedIntersections([]);
    setDirections(null);
    setDistanceInfo(null);
    setIsDrawerOpen(false);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Button onClick={resetSelections} variant="outline">
          Reset Selections
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
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Intersection Configuration</DrawerTitle>
            <DrawerDescription>
              Configure traffic signal timings for the selected intersections
            </DrawerDescription>
          </DrawerHeader>

          <div className="p-4">
            {distanceInfo && (
              <div className="mb-6 space-y-2">
                <div className="flex justify-between">
                  <Badge variant="outline">Distance</Badge>
                  <span>{distanceInfo.distance}</span>
                </div>
                <div className="flex justify-between">
                  <Badge variant="outline">Estimated Travel Time</Badge>
                  <span>{distanceInfo.duration}</span>
                </div>
                <div className="flex justify-between">
                  <Badge variant="outline">Current Time</Badge>
                  <span>{currentTime}</span>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h3 className="font-medium mb-2">Intersection Type</h3>
                <RadioGroup
                  value={intersectionType}
                  onValueChange={setIntersectionType}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fourway" id="fourway" />
                    <Label htmlFor="fourway">Four-way</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="threeway" id="threeway" />
                    <Label htmlFor="threeway">Three-way</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="twoway" id="twoway" />
                    <Label htmlFor="twoway">Two-way</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Green Signal Timings (seconds)</h3>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="timing1">Direction 1</Label>
                    <Input
                      id="timing1"
                      type="number"
                      value={greenTiming1}
                      onChange={(e) => setGreenTiming1(e.target.value)}
                      min="10"
                      max="120"
                    />
                  </div>

                  <div>
                    <Label htmlFor="timing2">Direction 2</Label>
                    <Input
                      id="timing2"
                      type="number"
                      value={greenTiming2}
                      onChange={(e) => setGreenTiming2(e.target.value)}
                      min="10"
                      max="120"
                    />
                  </div>

                  <div>
                    <Label htmlFor="timing3">Direction 3</Label>
                    <Input
                      id="timing3"
                      type="number"
                      value={greenTiming3}
                      onChange={(e) => setGreenTiming3(e.target.value)}
                      min="10"
                      max="120"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DrawerFooter>
            <Button onClick={handleSaveIntersection}>Save Configuration</Button>
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Maps;
