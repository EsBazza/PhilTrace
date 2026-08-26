'use client';

import { useState } from 'react';

interface ReviewModalProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReviewModal({
  projectId,
  projectName,
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
  const [phone, setPhone] = useState<string>('+639000000000');
  const [otp, setOtp] = useState<string>('123456');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    setErrorMsg(null);
    if (!phone || phone.length < 10) {
      setErrorMsg('Please enter a valid Philippine mobile number (+63...)');
      return;
    }

    try {
      const res = await fetch('/api/report/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        setOtpSent(true);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || 'Failed to dispatch OTP. (Use Demo +639000000000)');
      }
    } catch {
      setOtpSent(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!comment.trim()) {
      setErrorMsg('Please enter your observations or feedback.');
      return;
    }
    if (!otp) {
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
          phone,
          otp,
        }),
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || 'Failed to submit review. Check OTP code.');
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

          {/* Photo URL (Optional) */}
          <div className="space-y-1">
            <label className="font-medium text-gray-600">Ground Photo URL (Optional):</label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://imgur.com/photo.jpg or image link"
              className="w-full rounded-xl border border-gray-300 p-2 text-xs text-gray-900"
            />
          </div>

          {/* Phone Verification Section */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-900">📱 Anti-Spam Phone Verification</span>
              <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
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
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
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
              disabled={isSubmitting}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Verifying & Submitting...' : 'Submit Verified Review ⭐'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
