import { useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";

const typeLabel: Record<string, string> = { short_text: "短文", long_text: "長文", email: "メールアドレス", single_choice: "単一選択", multiple_choice: "複数選択" };
function optionsOf(raw: string | null) { try { return raw ? JSON.parse(raw) as string[] : []; } catch { return []; } }

export default function PublicForm() {
  const { slug = "demo" } = useParams<{ slug: string }>();
  const query = trpc.publicForms.get.useQuery({ slug });
  const submit = trpc.publicForms.submit.useMutation();
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [sent, setSent] = useState(false);
  if (query.isLoading) return <div className="grid min-h-screen place-items-center bg-[#f7f6f2]"><Loader2 className="animate-spin text-[#a57b36]"/></div>;
  if (query.error) return <div className="grid min-h-screen place-items-center bg-[#f7f6f2] p-6 text-center"><div><p className="font-serif text-3xl">受付を終了しています</p><p className="mt-3 text-[#6d756f]">このフォームは現在公開されていないか、URLが正しくありません。</p><Link href="/"><Button variant="outline" className="mt-7 rounded-full"><ArrowLeft className="mr-2" size={16}/>トップへ戻る</Button></Link></div></div>;
  if (sent) return <div className="grid min-h-screen place-items-center bg-[#f7f6f2] p-6"><div className="w-full max-w-lg rounded-[2rem] bg-white p-10 text-center shadow-[0_24px_80px_rgba(30,41,39,.10)]"><CheckCircle2 className="mx-auto h-12 w-12 text-[#728f79]"/><p className="mt-6 font-serif text-3xl">ありがとうございます。</p><p className="mt-3 leading-7 text-[#6d756f]">{query.data?.form.successMessage}</p></div></div>;
  const { form, questions } = query.data!;
  const update = (id: number, value: string | string[]) => setValues(prev => ({ ...prev, [String(id)]: value }));
  return <div className="min-h-screen bg-[#f7f6f2] px-5 py-10 text-[#1e2927] md:py-16"><div className="mx-auto max-w-2xl"><Link href="/"><span className="mb-8 inline-flex items-center text-sm text-[#727b73] hover:text-[#1e2927]"><ArrowLeft size={15} className="mr-2"/>Entry Atelier</span></Link><div className="rounded-[2rem] bg-white p-7 shadow-[0_24px_80px_rgba(30,41,39,.10)] md:p-12"><div className="border-b border-[#ece9e1] pb-8"><span className="rounded-full bg-[#f3ead8] px-3 py-1 text-xs font-semibold uppercase tracking-[.16em] text-[#9a7133]">Entry form</span><h1 className="mt-5 font-serif text-4xl leading-tight md:text-5xl">{form.title}</h1>{form.description && <p className="mt-4 leading-7 text-[#6d756f]">{form.description}</p>}</div><form className="space-y-8 pt-8" onSubmit={e => { e.preventDefault(); submit.mutate({ slug, values }, { onSuccess: () => setSent(true) }); }}>
    {questions.map((q, index) => { const opts = optionsOf(q.options); const current = values[String(q.id)] ?? (q.type === "multiple_choice" ? [] : ""); return <div key={q.id} className="space-y-3"><Label className="text-base font-medium">{String(index + 1).padStart(2, "0")} <span className="ml-2">{q.label}</span>{q.required ? <span className="ml-2 text-[#a57b36]">*</span> : null}</Label>{q.description && <p className="text-sm text-[#8a918b]">{q.description}</p>}{q.type === "long_text" ? <Textarea required={!!q.required} value={String(current)} onChange={e => update(q.id, e.target.value)} className="min-h-32 rounded-xl border-[#dedbd1] bg-[#fcfcfa]"/> : q.type === "short_text" || q.type === "email" ? <Input required={!!q.required} type={q.type === "email" ? "email" : "text"} value={String(current)} onChange={e => update(q.id, e.target.value)} className="h-12 rounded-xl border-[#dedbd1] bg-[#fcfcfa]"/> : <div className="grid gap-2">{opts.map(opt => q.type === "single_choice" ? <label key={opt} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e8e6df] px-4 py-3 hover:bg-[#faf9f5]"><input required={!!q.required} type="radio" name={String(q.id)} checked={current === opt} onChange={() => update(q.id, opt)} />{opt}</label> : <label key={opt} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e8e6df] px-4 py-3 hover:bg-[#faf9f5]"><Checkbox checked={Array.isArray(current) && current.includes(opt)} onCheckedChange={checked => update(q.id, checked ? [...(Array.isArray(current) ? current : []), opt] : (Array.isArray(current) ? current.filter(v => v !== opt) : []))}/>{opt}</label>)}</div>}</div> })}
    <Button disabled={submit.isPending} className="h-13 w-full rounded-full border border-[#a57b36] bg-[#a57b36] text-base font-semibold text-[#1e2927] shadow-[0_10px_24px_rgba(165,123,54,.22)] hover:bg-[#c19447] hover:text-[#1e2927] focus-visible:ring-2 focus-visible:ring-[#a57b36] focus-visible:ring-offset-2">{submit.isPending ? <Loader2 className="mr-2 animate-spin" size={17}/> : <Send className="mr-2" size={17}/>}回答を送信する</Button>{submit.error && <p className="text-center text-sm text-red-600">{submit.error.message}</p>}<p className="text-center text-xs text-[#9ca19c]">送信内容は安全に管理され、指定された連携先へ通知されます。</p>
  </form></div></div></div>;
}
