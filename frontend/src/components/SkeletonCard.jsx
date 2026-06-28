import React from "react";

export default function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-3xl p-5 shadow-sm space-y-4">
      {/* Category and Severity Shimmers */}
      <div className="flex items-center justify-between">
        <div className="w-24 h-5 rounded-full shimmer-bar" />
        <div className="w-16 h-5 rounded-full shimmer-bar" />
      </div>

      {/* Title Shimmer */}
      <div className="w-3/4 h-6 rounded-lg shimmer-bar" />

      {/* Description Shimmer */}
      <div className="space-y-2">
        <div className="w-full h-3 rounded shimmer-bar" />
        <div className="w-5/6 h-3 rounded shimmer-bar" />
      </div>

      {/* Metadata/Footer Shimmer */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800/40">
        <div className="w-20 h-4 rounded shimmer-bar" />
        <div className="w-24 h-8 rounded-xl shimmer-bar" />
      </div>
    </div>
  );
}
