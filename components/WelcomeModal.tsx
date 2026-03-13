
import React from 'react';
import { X, Zap, Layers, MessageSquare, FileText, Search } from 'lucide-react';

interface WelcomeModalProps {
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-studio-600 to-studio-800 px-8 py-8 text-white text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors rounded-lg p-1.5 hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg backdrop-blur-sm">
            <Zap className="text-white w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold">Welcome to VentureForge</h2>
          <p className="text-studio-200 mt-1.5 text-sm">Your AI-powered venture research engine</p>
        </div>
        
        {/* Features */}
        <div className="p-7">
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-start gap-4">
              <div className="bg-blue-50 p-2.5 rounded-xl shrink-0">
                <Layers className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">14-Step Research Pipeline</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Interconnected modules that build on each other — from trend detection through to pitch deck outlines.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-studio-50 p-2.5 rounded-xl shrink-0">
                <Zap className="w-4 h-4 text-studio-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Continuous Mode</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Enabled by default. The pipeline runs automatically from start to finish. Disable it to step through manually.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-purple-50 p-2.5 rounded-xl shrink-0">
                <Search className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Live Web Research</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Key modules use real-time Google Search grounding to validate trends, find competitors, and cite sources.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-amber-50 p-2.5 rounded-xl shrink-0">
                <MessageSquare className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Deep Dive Chat</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Chat with each module's output. Upload files and ask follow-up questions to go deeper on any section.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-green-50 p-2.5 rounded-xl shrink-0">
                <FileText className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Professional PDF Export</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Export a full-length, formatted report including all analysis, citations, and chat history.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-studio-600 text-white text-sm font-semibold rounded-xl hover:bg-studio-700 transition-colors shadow-sm"
            >
              Start Researching
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
