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

  useEffect(() => {
    async function init() {
      const { data } = await supabase.from("diseases").select("*");
      if (data) setDiseases(data);
    }
    init();
  }, []);

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
        return { ...p, status: "DECLINE", reason: isDeclined ? "Auto-Decline Triggered" : "Risk Threshold Reached" };
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

  const totalPossible = questions.length;
  const answeredCount = Object.keys(answers).length;
  const progress = totalPossible > 0 ? Math.round((answeredCount / totalPossible) * 100) : 0;

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-80 bg-white border-r border-slate-200 p-8 flex flex-col hidden lg:flex sticky top-0 h-screen">
        <div className="mb-10">
          <h2 className="text-2xl font-black tracking-tighter text-indigo-600 italic">OMNI-INSURE</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Selection-Driven UI</p>
        </div>

        <nav className="flex-1 space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Select Conditions</p>
          {diseases.map(d => {
            const isSelected = selectedDiseases.includes(d.id);
            const selectionIndex = selectedDiseases.indexOf(d.id) + 1;
            
            return (
              <button
                key={d.id}
                onClick={() => {
                  setSelectedDiseases(prev => 
                    prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]
                  );
                  setReport(null);
                }}
                className={`w-full text-left px-5 py-4 rounded-2xl font-bold transition-all flex items-center justify-between border ${
                  isSelected 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                  : "bg-white text-slate-500 border-slate-100 hover:border-indigo-200 hover:bg-slate-50"
                }`}
              >
                <span>{d.name}</span>
                {isSelected && (
                  <span className="bg-white/20 w-6 h-6 rounded-full flex items-center justify-center text-[10px]">
                    {selectionIndex}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-slate-100">
           <button 
             onClick={() => {setSelectedDiseases([]); setAnswers({}); setReport(null);}}
             className="w-full py-3 text-[10px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase border border-dashed border-slate-200 rounded-xl"
           >
             Reset Assessment
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 lg:p-16 overflow-y-auto">
        <header className="max-w-4xl mx-auto mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Assessment Flow</h1>
            <p className="text-slate-500 mt-1">Questions appear in order of selection.</p>
          </div>
          {questions.length > 0 && (
            <div className="bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm text-center">
               <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{progress}% Complete</p>
               <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden mx-auto">
                  <div className="h-full bg-indigo-500 transition-all duration-700" style={{width: `${progress}%`}}></div>
               </div>
            </div>
          )}
        </header>

        <div className="max-w-4xl mx-auto">
          {selectedDiseases.length === 0 ? (
            <div className="h-[60vh] border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center text-slate-400">
              <p className="font-bold text-lg">Waiting for Selection</p>
              <p className="text-sm mt-1">Please select conditions from the left sidebar.</p>
            </div>
          ) : (
            <div className="space-y-16">
              {/* WE ITERATE THROUGH selectedDiseases ARRAY TO PRESERVE CLICK ORDER */}
              {selectedDiseases.map((diseaseId, index) => {
                const diseaseName = diseases.find(d => d.id === diseaseId)?.name;
                const diseaseQuestions = questions.filter(q => q.disease_id === diseaseId);

                return (
                  <section key={diseaseId} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-4">
                      <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-indigo-100">
                        {index + 1}
                      </span>
                      <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">
                        {diseaseName}
                      </h2>
                      <div className="h-px flex-1 bg-slate-200"></div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {diseaseQuestions.map((q) => (
                        <div key={q.id} className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm transition-all hover:border-indigo-100">
                          <p className="text-xl font-bold text-slate-800 leading-snug mb-8">{q.question_text}</p>
                          <div className="flex gap-4">
                            {q.question_options.map((opt: any) => (
                              <button
                                key={opt.id}
                                onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                                className={`flex-1 py-5 rounded-2xl font-black transition-all transform active:scale-95 ${
                                  answers[q.id]?.id === opt.id 
                                  ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]" 
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

              <button 
                onClick={handleEvaluate}
                disabled={answeredCount < totalPossible}
                className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-xl shadow-2xl hover:bg-indigo-600 transition-all disabled:opacity-20 mt-12 mb-20"
              >
                {answeredCount < totalPossible ? `COMPLETE ${totalPossible - answeredCount} MORE QUESTIONS` : "GENERATE FINAL ANALYSIS"}
              </button>
            </div>
          )}

          {report && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-20">
              {report.map(res => (
                <div key={res.type} className={`p-10 rounded-[3rem] border-2 flex flex-col items-center text-center ${
                  res.status === 'DECLINE' ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'
                }`}>
                  <span className="text-5xl mb-4">{res.icon}</span>
                  <h3 className="font-black text-slate-400 uppercase text-[10px] tracking-widest mb-1">{res.type}</h3>
                  <div className={`text-3xl font-black mb-6 ${res.status === 'DECLINE' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {res.status}
                  </div>
                  {res.status === "ACCEPT" ? (
                    <div className="space-y-2">
                       <p className="text-sm font-bold text-slate-700">Premium: {res.loading}</p>
                       <p className="text-[10px] text-slate-400 uppercase font-black">{res.exclusions.join(", ")}</p>
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-rose-800">{res.reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
