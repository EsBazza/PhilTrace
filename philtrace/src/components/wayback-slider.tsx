'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface WaybackSliderProps {
  gpsLat: number;
  gpsLng: number;
  startDate?: string | Date;
  completionDate?: string | Date | null;
}

export default function WaybackSlider({ gpsLat, gpsLng, startDate }: WaybackSliderProps) {
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startYear = startDate ? new Date(startDate).getFullYear() : 2021;
  const currentYear = new Date().getFullYear();

  // Static high-res imagery preview endpoints
  const pastImageUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${gpsLng - 0.005},${gpsLat - 0.003},${gpsLng + 0.005},${gpsLat + 0.003}&bboxSR=4326&imageSR=4326&size=800,500&format=jpg&f=image`;
  const currentImageUrl = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${gpsLng},${gpsLat},16,0/800x500?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`;

  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pos);
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleTouchStart = () => setIsDragging(true);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) handleMove(e.touches[0].clientX);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMove]);

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
        <span className="flex items-center gap-1.5 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          ⏮️ Past Baseline ({startYear})
        </span>
        <span className="text-[11px] text-gray-400">Drag divider to compare</span>
        <span className="flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
          Present Proof ({currentYear}) ⏭️
        </span>
      </div>

      {/* Interactive Split-Screen Image Container */}
      <div
        ref={containerRef}
        className="relative h-60 w-full overflow-hidden rounded-xl border border-gray-200 shadow-inner cursor-ew-resize bg-gray-900"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Present Image (Full Width Underneath) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImageUrl}
          alt="Present Satellite View"
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />

        {/* Past Image (Clipped by slider position) */}
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pastImageUrl}
            alt="Historical Satellite View"
            className="absolute inset-0 h-full max-w-none object-cover pointer-events-none"
            style={{ width: containerWidth ? `${containerWidth}px` : '100%' }}
          />
        </div>

        {/* Divider Bar & Handle */}
        <div
          className="absolute inset-y-0 z-10 w-1 bg-white shadow-[0_0_10px_rgba(0,0,0,0.8)]"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-900 shadow-xl border-2 border-blue-600 font-bold text-xs">
            ⇄
          </div>
        </div>

        {/* Corner Badges */}
        <div className="absolute bottom-2 left-2 z-10 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          BEFORE ({startYear})
        </div>
        <div className="absolute bottom-2 right-2 z-10 rounded-md bg-blue-600/90 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
          CURRENT ({currentYear})
        </div>
      </div>
    </div>
  );
}
