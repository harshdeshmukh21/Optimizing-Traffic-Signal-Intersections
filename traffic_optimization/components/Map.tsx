"use client"; // Ensures this runs only on the client side

import React, { useState, useCallback } from "react";
import {
  GoogleMap,
  LoadScript,
  TrafficLayer,
  Marker,
} from "@react-google-maps/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const containerStyle = {
  width: "100%",
  height: "500px", // Adjust height as needed
};

const initialCenter = {
  lat: 19.0171,
  lng: 73.0175,
};

const trafficDescriptions = {
  RED: { label: "Severe Traffic", color: "red" },
  ORANGE: { label: "Heavy Traffic", color: "orange" },
  GREEN: { label: "No Traffic", color: "green" },
};

const Maps: React.FC = () => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedIntersection, setSelectedIntersection] =
    useState<google.maps.LatLngLiteral | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [trafficInfo, setTrafficInfo] = useState<{
    status: "RED" | "ORANGE" | "GREEN" | null;
    description?: string;
  } | null>(null);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const handleMapClick = useCallback(
    async (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        const latLng = {
          lat: event.latLng.lat(),
          lng: event.latLng.lng(),
        };
        setSelectedIntersection(latLng);
        map?.panTo(latLng); // Center the map on the selected point
        map?.setZoom(18); // Zoom in on the selected point (adjust as needed)

        // **Simulate fetching traffic data based on clicked location**
        const simulatedTraffic = await simulateGetTrafficData(latLng);
        setTrafficInfo(simulatedTraffic);
        setIsDialogOpen(true);
      }
    },
    [map]
  );

  // **Simulate API call to get traffic data**
  const simulateGetTrafficData = async (
    latLng: google.maps.LatLngLiteral
  ): Promise<{
    status: "RED" | "ORANGE" | "GREEN" | null;
    description?: string;
  }> => {
    return new Promise((resolve) => {
      const statuses = ["GREEN", "ORANGE", "RED"];
      const randomIndex = Math.floor(Math.random() * statuses.length);
      const randomStatus: "RED" | "ORANGE" | "GREEN" = statuses[randomIndex] as
        | "RED"
        | "ORANGE"
        | "GREEN";

      let description = "";
      if (randomStatus === "RED") {
        description = "Severe congestion detected.";
      } else if (randomStatus === "ORANGE") {
        description = "Heavy traffic flow.";
      } else if (randomStatus === "GREEN") {
        description = "Traffic is flowing freely.";
      }

      setTimeout(() => {
        resolve({ status: randomStatus, description });
      }, 500);
    });
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setTrafficInfo(null);
  };

  // Helper function to get badge className based on traffic status
  const getBadgeClassName = (status: "RED" | "ORANGE" | "GREEN") => {
    if (status === "RED") {
      return "bg-red-500 text-white";
    } else if (status === "ORANGE") {
      return "bg-orange-500 text-white";
    } else {
      return "bg-green-500 text-white";
    }
  };

  return (
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
          <Marker
            position={selectedIntersection}
            title="Selected Intersection"
          />
        )}

        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Traffic Information</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="mb-4">
              {trafficInfo?.status &&
                trafficDescriptions[trafficInfo.status] && (
                  <Badge
                    variant="outline"
                    className={getBadgeClassName(trafficInfo.status)}
                  >
                    {trafficDescriptions[trafficInfo.status].label}
                  </Badge>
                )}
              {trafficInfo?.description && (
                <AlertDialogDescription className="mt-2">
                  {trafficInfo.description}
                </AlertDialogDescription>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDialogClose}>
                Close
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </GoogleMap>
    </LoadScript>
  );
};

export default Maps;
