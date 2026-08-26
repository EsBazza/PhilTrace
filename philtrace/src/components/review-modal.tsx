'use client';

import { useState, useEffect, useCallback } from 'react';
import { isWithinReviewRadius, MAX_REVIEW_RADIUS_KM } from '@/lib/geo';

interface ReviewModalProps {
  projectId: string;
  projectName: string;
  projectLat?: number;
  projectLng?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewModal({
  projectId,
  projectName,
  projectLat,
  projectLng,
  isOpen,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [progressRating, setProgressRating] = useState<number>(80);
  const [qualityRating, setQualityRating] = useState<number>(4);
  const [workersActive, setWorkersActive] = useState<boolean>(true);
  const [comment, setComment] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [phone, setPhone] = useState<string>('+639000000000');
  const [otp, setOtp] = useState<string>('123456');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // GPS Geolocation State
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);

  const requestGeolocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setGeoStatus('locating');
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGeoStatus('granted');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGeoStatus('denied');
        setGeoError(
          err.code === 1
            ? 'Location access was denied. Please enable location permissions in your browser to rate this project.'
            : 'Unable to acquire GPS location. Please check your device location settings.'
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    if (isOpen) {
      requestGeolocation();
      setErrorMsg(null);
      setOtpSent(false);
      setPhotoUrl('');
      setPreviewUrl(null);
      setIsUploadingPhoto(false);
    }
  }, [isOpen, requestGeolocation]);

  if (!isOpen) return null;

  // Handle Photo File Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG, PNG, WebP, etc.).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 10MB limit. Please select a smaller photo.');
      return;
    }

    // Set immediate client-side preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setIsUploadingPhoto(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setPhotoUrl(data.url);
      } else {
        setErrorMsg(data.error || 'Failed to upload photo. Please try again.');
        setPreviewUrl(null);
        setPhotoUrl('');
      }
    } catch (err: any) {
      console.error('Photo upload error:', err);
      setErrorMsg('Network error while uploading photo.');
      setPreviewUrl(null);
      setPhotoUrl('');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    setPreviewUrl(null);
    setIsUploadingPhoto(false);
  };

  // Calculate distance & 15km eligibility
  const hasProjectCoords = projectLat !== undefined && projectLng !== undefined && projectLat !== 0 && projectLng !== 0;
  const hasUserCoords = userLat !== null && userLng !== null;

  const geoCheck =
    hasProjectCoords && hasUserCoords
      ? isWithinReviewRadius(userLat, userLng, projectLat, projectLng, MAX_REVIEW_RADIUS_KM)
      : null;

  const isEligibleByDistance = geoCheck ? geoCheck.isWithin : false;

  const handleSendOtp = async () => {
    setErrorMsg(null);
    if (!phone || phone.trim().length < 10) {
      setErrorMsg('Please enter a valid Philippine mobile number (+63...)');
      return;
    }

    if (!isEligibleByDistance) {
      setErrorMsg(`You must be within ${MAX_REVIEW_RADIUS_KM} km of the project site to request an OTP and submit a rating.`);
      return;
    }

    try {
      const res = await fetch('/api/report/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), projectId }),
      });

      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
      } else {
        setErrorMsg(data.error || 'Failed to dispatch OTP. (Use Demo +639000000000)');
      }
    } catch {
      setErrorMsg('Network error while requesting verification OTP.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!hasUserCoords) {
      setErrorMsg('GPS location is required to verify that you are within 15 km of the project site.');
      return;
    }

    if (!isEligibleByDistance) {
      setErrorMsg(
        `Distance restriction: You are ${geoCheck?.distanceKm} km away. Ratings are limited to within ${MAX_REVIEW_RADIUS_KM} km.`
      );
      return;
    }

    if (!comment.trim()) {
      setErrorMsg('Please enter your observations or feedback.');
      return;
    }
    if (!otp.trim()) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          rating,
          progressRating,
          qualityRating,
          workersActive,
          comment,
          photoUrl: photoUrl.trim() || undefined,
          phone: phone.trim(),
          otp: otp.trim(),
          userLat,
          userLng,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || 'Failed to submit review.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
          <div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              ⭐ Citizen Ground-Truth Audit
            </div>
            <h3 className="text-base font-bold text-gray-900 line-clamp-1 mt-0.5">{projectName}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-gray-100 p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"
          >
            ✕
          </button>
        </div>

        {/* ─── 15km Location Verification Status Banner ──────────────────── */}
        <div className="mt-3">
          {geoStatus === 'locating' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-800 flex items-center justify-between gap-2 animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-base">🛰️</span>
                <span>Verifying your GPS proximity to project site (15 km rule)...</span>
              </div>
            </div>
          )}

          {geoStatus === 'granted' && geoCheck && (
            geoCheck.isWithin ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-900 flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">📍</span>
                  <div>
                    <div className="font-bold flex items-center gap-1">
                      <span>Proximity Verified ({geoCheck.distanceKm} km away)</span>
                      <span className="bg-emerald-200 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded font-black">
                        &le; 15 km
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      You are within the 15 km local zone and eligible to submit a ground rating.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={requestGeolocation}
                  className="text-[10px] underline text-emerald-700 hover:text-emerald-900 shrink-0 font-medium"
                >
                  Refresh
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-950 shadow-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-rose-800">
                    <span className="text-base">🚫</span>
                    <span>Outside 15 km Rating Zone ({geoCheck.distanceKm} km away)</span>
                  </div>
                  <button
                    type="button"
                    onClick={requestGeolocation}
                    className="text-[11px] font-bold text-rose-700 underline shrink-0 hover:text-rose-900"
                  >
                    Re-check GPS
                  </button>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  To prevent fraudulent reviews, PhilTrace strictly limits project ratings to citizens located within <strong>15 km</strong> of the infrastructure site.
                </p>
              </div>
            )
          )}

          {(geoStatus === 'denied' || geoStatus === 'unsupported') && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <span className="text-base">⚠️</span>
                  <span>Location Access Required</span>
                </div>
                <button
                  type="button"
                  onClick={requestGeolocation}
                  className="rounded-lg bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-xs hover:bg-amber-700 transition"
                >
                  📡 Enable GPS
                </button>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {geoError || 'Please allow GPS location access in your browser to verify that you are within 15 km of this project.'}
              </p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 font-medium border border-red-200">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Overall Star Rating */}
          <div className="space-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <span className="font-bold text-gray-700">Overall Star Rating:</span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="text-2xl transition-transform hover:scale-110"
                >
                  {star <= rating ? '⭐' : '☆'}
                </button>
              ))}
              <span className="font-extrabold text-sm text-gray-800 ml-2">
                {rating}.0 / 5.0
              </span>
            </div>
          </div>

          {/* Detailed Criteria */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
              <span className="font-medium text-gray-600">Physical Progress Observed:</span>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={progressRating}
                  onChange={(e) => setProgressRating(Number(e.target.value))}
                  className="w-full cursor-pointer accent-blue-600"
                />
                <span className="font-bold text-gray-900">{progressRating}%</span>
              </div>
            </div>

            <div className="space-y-1 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
              <span className="font-medium text-gray-600">Site Activity:</span>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setWorkersActive(true)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
                    workersActive
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  👷 Active
                </button>
                <button
                  type="button"
                  onClick={() => setWorkersActive(false)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${
                    !workersActive
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  🏚️ Abandoned
                </button>
              </div>
            </div>
          </div>

          {/* Observations / Comment */}
          <div className="space-y-1">
            <label className="font-bold text-gray-700">Citizen Observations & Notes:</label>
            <textarea
              required
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Describe actual ground condition, quality of road/bridge, any safety hazards or delays..."
              className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Ground Photo Image Upload (Optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-gray-700">📸 Ground Photo Proof (Optional):</label>
              {photoUrl && (
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  ✓ Photo Attached
                </span>
              )}
            </div>

            {previewUrl || photoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-900 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl || photoUrl}
                  alt="Ground preview"
                  className="h-36 w-full object-cover"
                />
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold gap-2">
                    <span className="animate-spin">⏳</span> Uploading image...
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isUploadingPhoto}
                    className="rounded-full bg-red-600/90 text-white p-1 hover:bg-red-700 shadow-md transition disabled:opacity-50"
                    title="Remove Photo"
                  >
                    <span className="text-xs px-1 font-bold">✕</span>
                  </button>
                </div>
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/80 p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 transition ${
                  isUploadingPhoto ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="text-2xl mb-1">📷</span>
                <span className="font-bold text-gray-800 text-xs">
                  {isUploadingPhoto ? 'Uploading image...' : 'Click to Upload Ground Photo'}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5">
                  Supports JPG, PNG, WebP or camera capture (Max 10MB)
                </span>
              </label>
            )}
          </div>

          {/* Phone Verification Section (1 OTP = 1 Review) */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-blue-900">📱 Anti-Fraud Phone Verification</span>
                <p className="text-[10px] text-blue-700 mt-0.5">1 OTP code = 1 review per project</p>
              </div>
              <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-mono">
                Demo: +639000000000 / 123456
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+639171234567"
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-900"
              />
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={!isEligibleByDistance}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={!isEligibleByDistance ? 'Must be within 15 km of project to request OTP' : ''}
              >
                {otpSent ? 'Resend OTP' : 'Send OTP'}
              </button>
            </div>

            <div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP code"
                maxLength={6}
                className="w-full rounded-lg border border-gray-300 bg-white p-2 text-xs text-gray-900 font-mono tracking-widest text-center font-bold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingPhoto || !isEligibleByDistance}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? 'Verifying & Submitting...'
                : isUploadingPhoto
                ? 'Uploading Photo...'
                : !isEligibleByDistance
                ? 'Location Restricted (&gt; 15 km)'
                : 'Submit Verified Review ⭐'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
