"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

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

  // Initialize Diseases
  useEffect(() => {
    async function init() {
      const { data } = await supabase.from("diseases").select("*");
      if (data) setDiseases(data);
    }
    init();
  }, []);

  // Load Questions whenever selected diseases change
  useEffect(() => {
    async function loadQuestions() {
      if (selectedDiseases.length === 0) {
        setQuestions([]);
        return;
      }
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
        return { ...p, status: "DECLINE", reason: isDeclined ? "High Risk Logic" : "Score Threshold Exceeded" };
      }
      return {
        ...p,
        status: "ACCEPT",
        loading: score > 0 ? `+${score * 25}%` : "Standard Rate",
        exclusions: Array.from(new Set(exclusions))
      };
    });
    setReport(finalResults);
  };

  const totalPossible = questions.length;
  const answeredCount = Object.keys(answers).length;
  const progress = totalPossible > 0 ? Math.round((answeredCount / totalPossible) * 100) : 0;

  // Helper to check if a specific disease is "finished"
  const isDiseaseComplete = (diseaseId: string) => {
    const diseaseQs = questions.filter(q => q.disease_id === diseaseId);
    if (diseaseQs.length === 0) return false;
    return diseaseQs.every(q => answers[q.id]);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-80 bg-white border-r border-slate-200 p-8 flex flex-col hidden lg:flex sticky top-0 h-screen">
        <div className="mb-10">
          <h2 className="text-2xl font-black tracking-tighter text-indigo-600 italic">OMNI-INSURE</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Underwriting v2.1</p>
        </div>

        <nav className="flex-1 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-wider">Patient Portfolio</p>
          {diseases.map(d => (
            <button
              key={d.id}
              onClick={() => {
                setSelectedDiseases(prev => prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]);
                setReport(null);
              }}
              className={`w-full text-left px-5 py-3 rounded-2xl font-bold transition-all flex justify-between items-center ${
                selectedDiseases.includes(d.id) 
                ? "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200 shadow-sm" 
                : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span>{d.name}</span>
              {selectedDiseases.includes(d.id) && isDiseaseComplete(d.id) && (
                <span className="text-emerald-500 text-xs">✓</span>
              )}
            </button>
          ))}
        </nav>

        <div className="pt-6 border-t border-slate-100">
           <button 
             onClick={() => {setSelectedDiseases([]); setAnswers({}); setReport(null);}}
             className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors uppercase"
           >
             Clear All Assessment Data
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 lg:p-16 overflow-y-auto">
        <header className="max-w-4xl mx-auto mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Risk Assessment</h1>
            <p className="text-slate-500 mt-2 font-medium">Grouped clinical review for multi-policy decisioning.</p>
          </div>
          {questions.length > 0 && (
            <div className="text-right">
               <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{progress}% Processed</p>
               <div className="w-32 h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-700 ease-out" style={{width: `${progress}%`}}></div>
               </div>
            </div>
          )}
        </header>

        <div className="max-w-4xl mx-auto">
          {selectedDiseases.length === 0 ? (
            <div className="h-96 border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-400 p-10 text-center">
              <div className="text-4xl mb-4">🩺</div>
              <p className="font-bold text-slate-500">No conditions selected</p>
              <p className="text-sm max-w-xs mt-2">Select one or more medical conditions from the sidebar to begin the underwriting questionnaire.</p>
            </div>
          ) : (
            <>
              {/* GROUPED QUESTIONS */}
              <div className="space-y-20 mb-16">
                {selectedDiseases.map((diseaseId) => {
                  const diseaseName = diseases.find(d => d.id === diseaseId)?.name;
                  const diseaseQuestions = questions.filter(q => q.disease_id === diseaseId);

                  if (diseaseQuestions.length === 0) return null;

                  return (
                    <section key={diseaseId} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center gap-6">
                        <h2 className="text-xs font-black text-indigo-500 uppercase tracking-[0.3em] whitespace-nowrap">
                          Section: {diseaseName}
                        </h2>
                        <div className="h-px w-full bg-gradient-to-r from-slate-200 to-transparent"></div>
                      </div>

                      <div className="grid grid-cols-1 gap-8">
                        {diseaseQuestions.map((q) => (
                          <div key={q.id} className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all hover:shadow-md hover:border-indigo-100 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-start justify-between gap-6">
                              <p className="text-xl font-bold text-slate-800 leading-tight pr-4">{q.question_text}</p>
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{q.id}</span>
                            </div>
                            <div className="flex gap-4 mt-10">
                              {q.question_options.map((opt: any) => (
                                <button
                                  key={opt.id}
                                  onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                                  className={`flex-1 py-5 rounded-2xl font-black transition-all transform active:scale-95 text-sm tracking-wide ${
                                    answers[q.id]?.id === opt.id 
                                    ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200 ring-4 ring-indigo-50" 
                                    : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                  }`}
                                >
                                  {opt.option_text.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>

              <div className="sticky bottom-8">
                <button 
                  onClick={handleEvaluate}
                  disabled={answeredCount < totalPossible}
                  className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-xl shadow-2xl hover:bg-indigo-600 transition-all disabled:opacity-20 disabled:cursor-not-allowed transform hover:-translate-y-1 active:translate-y-0"
                >
                  {answeredCount < totalPossible 
                    ? `FINISH ${totalPossible - answeredCount} MORE QUESTIONS` 
                    : "GENERATE ANALYTIC REPORT"}
                </button>
              </div>
            </>
          )}

          {/* RESULTS GRID */}
          {report && (
            <div className="mt-24 mb-20 grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
              {report.map(res => (
                <div key={res.type} className={`relative p-10 rounded-[3.5rem] border-2 flex flex-col items-center transition-all shadow-xl ${
                  res.status === 'DECLINE' ? 'bg-rose-50 border-rose-100 shadow-rose-100/50' : 'bg-emerald-50 border-emerald-100 shadow-emerald-100/50'
                }`}>
                  <span className="text-5xl mb-6">{res.icon}</span>
                  <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] mb-2">{res.type}</h3>
                  <div className={`text-3xl font-black mb-8 tracking-tight ${res.status === 'DECLINE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {res.status}
                  </div>
                  
                  <div className="w-full space-y-4 mt-auto">
                    {res.status === "ACCEPT" ? (
                      <>
                        <div className="bg-white/90 p-5 rounded-3xl backdrop-blur-sm shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">Premium Loading</p>
                          <p className="text-xl font-bold text-slate-900">{res.loading}</p>
                        </div>
                        {res.exclusions.length > 0 && (
                          <div className="bg-white/90 p-5 rounded-3xl backdrop-blur-sm shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">Specific Exclusions</p>
                            <div className="flex flex-wrap gap-2">
                              {res.exclusions.map((ex: string) => (
                                <span key={ex} className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase">{ex}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="bg-rose-100/80 p-6 rounded-3xl text-center backdrop-blur-sm">
                        <p className="text-xs font-black text-rose-800 uppercase tracking-widest mb-1">Reason</p>
                        <p className="text-sm font-bold text-rose-900">{res.reason}</p>
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
