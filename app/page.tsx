"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
// Optional: If you want icons, run 'npm install lucide-react' 
// I will use standard emojis for now so it works immediately!

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const POLICIES = [
  { type: "Medical", icon: "🏥" },
  { type: "Life", icon: "🧬" },
  { type: "Critical Illness", icon: "🛡️" }
];

export default function UnderwritingApp() {
  const [diseases, setDiseases] = useState<any[]>([]);
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [report, setReport] = useState<any[] | null>(null);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from("diseases").select("*");
      if (data) setDiseases(data);
    }
    init();
  }, []);

  useEffect(() => {
    async function loadQuestions() {
      if (selectedDiseases.length === 0) return setQuestions([]);
      const { data } = await supabase
        .from("questions")
        .select("*, question_options(*, option_impacts(*))")
        .in("disease_id", selectedDiseases)
        .order("display_order", { ascending: true });
      if (data) setQuestions(data);
    }
    loadQuestions();
  }, [selectedDiseases]);

  const handleEvaluate = () => {
    const finalResults = POLICIES.map(p => {
      let score = 0;
      let exclusions: string[] = [];
      let isDeclined = false;

      Object.values(answers).forEach((opt: any) => {
        const impact = opt.option_impacts?.find((i: any) => i.policy_type === p.type);
        if (impact) {
          if (impact.is_decline) isDeclined = true;
          score += impact.loading_value || 0;
          if (impact.is_exclusion && impact.exclusion_name) exclusions.push(impact.exclusion_name);
        }
      });

      if (isDeclined || score >= 3) {
        return { ...p, status: "DECLINE", reason: isDeclined ? "Auto-Decline" : "High Risk Score" };
      }
      return {
        ...p,
        status: "ACCEPT",
        loading: score > 0 ? `+${score * 25}%` : "Standard",
        exclusions: Array.from(new Set(exclusions))
      };
    });
    setReport(finalResults);
  };

  const progress = questions.length > 0 ? Math.round((Object.keys(answers).length / questions.length) * 100) : 0;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* SIDEBAR: Disease Selection */}
      <aside className="w-80 bg-white border-r border-slate-200 p-8 flex flex-col hidden lg:flex">
        <div className="mb-10">
          <h2 className="text-2xl font-black tracking-tighter text-indigo-600 italic">OMNI-INSURE</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Underwriting v2.0</p>
        </div>

        <nav className="flex-1 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Patient Conditions</p>
          {diseases.map(d => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDiseases(prev => prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]);
                setReport(null);
              }}
              className={`w-full text-left px-5 py-3 rounded-2xl font-bold transition-all ${
                selectedDiseases.includes(d.id) 
                ? "bg-indigo-50 text-indigo-600 ring-2 ring-indigo-500/20 shadow-sm" 
                : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {d.name}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-slate-100">
           <button 
             onClick={() => {setSelectedDiseases([]); setAnswers({}); setReport(null);}}
             className="text-xs font-bold text-red-400 hover:text-red-600 transition"
           >
             Clear All Data
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 lg:p-16 overflow-y-auto">
        <header className="max-w-4xl mx-auto mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900">Risk Assessment</h1>
            <p className="text-slate-500 mt-2">Analyze medical disclosures across multi-policy benchmarks.</p>
          </div>
          {questions.length > 0 && (
            <div className="text-right">
               <p className="text-xs font-black text-indigo-500 uppercase">{progress}% Complete</p>
               <div className="w-32 h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-500" style={{width: `${progress}%`}}></div>
               </div>
            </div>
          )}
        </header>

        <div className="max-w-4xl mx-auto">
          {selectedDiseases.length === 0 ? (
            <div className="h-96 border-4 border-dashed border-slate-200 rounded-[3rem] flex items-center justify-center text-slate-400 font-medium">
              Select a condition from the sidebar to begin.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 mb-12">
                {questions.map((q) => (
                  <div key={q.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 group transition-all hover:shadow-md">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-xl font-bold text-slate-800 leading-tight">{q.question_text}</p>
                      <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-md font-black text-slate-400 uppercase">{q.id.split('_')[0]}</span>
                    </div>
                    <div className="flex gap-4 mt-8">
                      {q.question_options.map((opt: any) => (
                        <button
                          key={opt.id}
                          onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                          className={`flex-1 py-4 rounded-2xl font-black transition-all transform active:scale-95 ${
                            answers[q.id]?.id === opt.id 
                            ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200" 
                            : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                          }`}
                        >
                          {opt.option_text}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleEvaluate}
                disabled={Object.keys(answers).length < questions.length}
                className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xl shadow-2xl hover:bg-indigo-600 transition-all disabled:opacity-20"
              >
                GENERATE UNDERWRITING REPORT
              </button>
            </>
          )}

          {/* RESULTS GRID */}
          {report && (
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {report.map(res => (
                <div key={res.type} className={`relative p-8 rounded-[3rem] border-2 flex flex-col items-center transition-all ${
                  res.status === 'DECLINE' ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
                }`}>
                  <span className="text-4xl mb-4">{res.icon}</span>
                  <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-1">{res.type}</h3>
                  <div className={`text-3xl font-black mb-6 ${res.status === 'DECLINE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {res.status}
                  </div>
                  
                  <div className="w-full space-y-3 mt-auto">
                    {res.status === "ACCEPT" ? (
                      <>
                        <div className="bg-white/80 p-4 rounded-2xl backdrop-blur-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Premium rate</p>
                          <p className="text-lg font-bold text-slate-900">{res.loading}</p>
                        </div>
                        {res.exclusions.length > 0 && (
                          <div className="bg-white/80 p-4 rounded-2xl backdrop-blur-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Active Exclusions</p>
                            <p className="text-slate-700 text-xs font-bold leading-tight">{res.exclusions.join(", ")}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-rose-100 p-4 rounded-2xl text-center">
                        <p className="text-xs font-bold text-rose-800">{res.reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}