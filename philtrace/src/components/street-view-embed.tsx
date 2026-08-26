'use client';

import { useState } from 'react';

interface StreetViewEmbedProps {
  gpsLat: number;
  gpsLng: number;
  projectName: string;
}

export default function StreetViewEmbed({ gpsLat, gpsLng, projectName }: StreetViewEmbedProps) {
  const [viewMode, setViewMode] = useState<'streetview' | 'satellite'>('streetview');

  // Google Street View Embed URL using standard coords
  const streetViewUrl = `https://www.google.com/maps/embed/v1/streetview?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'demo'}&location=${gpsLat},${gpsLng}&heading=210&pitch=10&fov=80`;
  const googleMapsExternalUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${gpsLat},${gpsLng}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-gray-700">360° Ground View</span>
          <span className="text-[10px] text-gray-400">({gpsLat.toFixed(4)}, {gpsLng.toFixed(4)})</span>
        </div>
        <a
          href={googleMapsExternalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
        >
          Open in Google Maps &rarr;
        </a>
      </div>

      <div className="relative h-60 w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-slate-900 flex items-center justify-center">
        <iframe
          title={`Google Street View of ${projectName}`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          src={`https://maps.google.com/maps?q=${gpsLat},${gpsLng}&hl=en&z=17&output=embed`}
        />

        <div className="absolute top-2 right-2 rounded-md bg-black/75 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-md">
          📍 Project Coordinates
        </div>
      </div>
    </div>
  );
}
