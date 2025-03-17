"use client"; // Ensures this runs only on the client side

import React, { useState, useCallback } from "react";
import {
  GoogleMap,
  LoadScript,
  TrafficLayer,
  Marker,
  StandaloneSearchBox,
} from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "500px", // Adjust height as needed
};

const center = {
  lat: 19.0171,
  lng: 73.0175,
};

const searchBoxStyle: React.CSSProperties = {
  boxSizing: "border-box",
  border: "1px solid transparent",
  width: "300px",
  height: "40px",
  padding: "0 12px",
  borderRadius: "20px",
  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
  fontSize: "14px",
  outline: "none",
  textOverflow: "ellipsis",
  position: "absolute",
  top: "15px",
  left: "50%",
  transform: "translateX(-50%)", // Centers the input box horizontally
};

const Maps: React.FC = () => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [searchBox, setSearchBox] =
    useState<google.maps.places.SearchBox | null>(null);
  const [markers, setMarkers] = useState<google.maps.LatLngLiteral[]>([center]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onSearchBoxLoad = useCallback((box: google.maps.places.SearchBox) => {
    setSearchBox(box);
  }, []);

  const onPlacesChanged = useCallback(() => {
    if (searchBox && map) {
      const places = searchBox.getPlaces();

      if (places && places.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        const newMarkers: google.maps.LatLngLiteral[] = [];

        places.forEach((place) => {
          if (!place.geometry || !place.geometry.location) return;

          newMarkers.push({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });

          if (place.geometry.viewport) {
            bounds.union(place.geometry.viewport);
          } else {
            bounds.extend(place.geometry.location);
          }
        });

        setMarkers(newMarkers);
        map.fitBounds(bounds);
      }
    }
  }, [searchBox, map]);

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      libraries={["places"]}
    >
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={20}
        onLoad={onMapLoad}
      >
        <TrafficLayer />

        {markers.map((position, index) => (
          <Marker key={index} position={position} draggable />
        ))}

        <StandaloneSearchBox
          onLoad={onSearchBoxLoad}
          onPlacesChanged={onPlacesChanged}
        >
          <input
            type="text"
            placeholder="Search for places"
            className="flex items-center justify"
            style={searchBoxStyle}
          />
        </StandaloneSearchBox>
      </GoogleMap>
    </LoadScript>
  );
};

export default Maps;
