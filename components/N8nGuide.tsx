
import React from 'react';
import { 
  Workflow, 
  Terminal, 
  Cpu, 
  MessageSquare, 
  ArrowRight, 
  ExternalLink,
  Code2,
  ListOrdered,
  Layers,
  Sparkles
} from 'lucide-react';

const N8nGuide: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">n8n AI Agent Setup Guide</h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Learn how to build a professional-grade security auditor on n8n using Gemini AI to process your firewall configurations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4">
            <Workflow className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800">1. Workflow Structure</h3>
          <p className="text-sm text-slate-500 mt-2">Design a robust pipeline that securely fetches, parses, and analyzes data.</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800">2. AI Logic</h3>
          <p className="text-sm text-slate-500 mt-2">Use Gemini with structured output to ensure predictable, high-quality audits.</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-4">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800">3. API Integration</h3>
          <p className="text-sm text-slate-500 mt-2">Connect to FortiGate, Palo Alto, or Cisco APIs using the provided keys.</p>
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center space-x-2">
          <ListOrdered className="w-6 h-6 text-blue-600" />
          <span>Step-by-Step Instructions</span>
        </h2>

        <div className="space-y-6">
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Node 1: Webhook (The Entry Point)</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-black uppercase tracking-tighter">Trigger</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">Create a new Webhook node. This is where this frontend app sends the IP and API Key.</p>
              <ul className="list-disc pl-5 text-sm text-slate-500 space-y-2">
                <li><strong>HTTP Method:</strong> POST</li>
                <li><strong>Path:</strong> firewall-audit</li>
                <li><strong>Authentication:</strong> None (or Header Auth for production security)</li>
              </ul>
              <div className="bg-slate-900 rounded-lg p-3 text-xs text-blue-300 font-mono">
                // Example input received from app<br/>
                {"{ \"ipAddress\": \"...\", \"apiKey\": \"...\", \"vendor\": \"fortinet\" }"}
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Node 2: HTTP Request (The Data Fetcher)</h3>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-1 rounded font-black uppercase tracking-tighter">Action</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">Configure this node to query the firewall's specific API. For example, on a FortiGate:</p>
              <ul className="list-disc pl-5 text-sm text-slate-500 space-y-2">
                <li><strong>Method:</strong> GET</li>
                <li><strong>URL:</strong> {"https://{{$json.ipAddress}}/api/v2/cmdb/firewall/policy"}</li>
                <li><strong>Headers:</strong> Authorization: {"Bearer {{$json.apiKey}}"}</li>
              </ul>
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex items-start space-x-3">
                <Terminal className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">Note: Ensure your n8n instance has network visibility to the firewall's IP address. If the firewall is behind a NAT, use a VPN or an n8n tunnel.</p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Node 3: AI Agent (The Brain)</h3>
              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded font-black uppercase tracking-tighter">Intelligence</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">Use the <strong>AI Agent</strong> node or <strong>Basic LLM Chain</strong> with the Gemini 3 Pro model.</p>
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-800 uppercase mb-2">System Instruction</h4>
                  <p className="text-xs text-slate-500 leading-relaxed italic">
                    "You are a Senior Network Security Auditor. Analyze the following firewall configuration JSON. 
                    Identify risky 'Any' rules, management exposures, and outdated encryption. 
                    Return a valid JSON object matching this schema: 
                    {"{ \"overallScore\": number, \"summary\": string, \"findings\": [{ \"title\": string, \"risk\": \"Low\"|\"Medium\"|\"High\"|\"Critical\", ... }] }"}"
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-sm text-blue-600">
                  <Sparkles className="w-4 h-4" />
                  <span>Recommend using <strong>gemini-3-pro-preview</strong> for deep config analysis.</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Node 4: Webhook Response</h3>
              <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-black uppercase tracking-tighter">Output</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-600 text-sm">Map the AI's JSON output to the response body of the initial Webhook node. Ensure the 'Respond to Webhook' node is at the end of your chain.</p>
              <button className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-sm font-bold transition-colors">
                <span>View Full Template in n8n Library</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </section>
        </div>
      </div>

      <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
          <div className="space-y-4 max-w-xl">
            <h2 className="text-3xl font-bold">Ready to automate?</h2>
            <p className="opacity-80">Once your n8n workflow is live, copy the "Production Webhook URL" and paste it into the Audit Dashboard configuration.</p>
            <div className="flex space-x-4 pt-4">
              <a 
                href="https://n8n.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition-colors"
              >
                Open n8n
              </a>
              <button 
                onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
                className="bg-slate-800 text-white border border-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
          <Workflow className="w-48 h-48 text-slate-800 absolute -right-8 -bottom-8 transform rotate-12" />
        </div>
      </div>
    </div>
  );
};

export default N8nGuide;
