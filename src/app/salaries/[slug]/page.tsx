import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

export const revalidate = 86400; // Cache for 24 hours (ISR)

type Props = {
  params: Promise<{ slug: string }>;
};

// Generate SEO meta tags dynamically
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const salary = await prisma.salary.findUnique({ where: { slug } });
  
  if (!salary) return { title: 'Not Found' };
  
  return {
    title: `${salary.profession} Salary in ${salary.city}, ${salary.state} - 2026 Guide`,
    description: `Discover the average salary for a ${salary.profession} in ${salary.city}, ${salary.state}. Average pay is $${salary.avgSalary.toLocaleString()} based on ${salary.jobCount} job openings.`,
  };
}

export default async function SalaryPage({ params }: Props) {
  const { slug } = await params;
  const salary = await prisma.salary.findUnique({ where: { slug } });

  if (!salary) {
    notFound();
  }

  return (
    <main className="min-h-screen p-10 bg-slate-50 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-emerald-600 p-10 text-white">
          <p className="uppercase tracking-widest text-emerald-100 font-semibold text-sm mb-2">Salary Guide</p>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            {salary.profession} in {salary.city}, {salary.state}
          </h1>
          <p className="text-emerald-100 text-lg">Comprehensive compensation data and job market insights.</p>
        </div>
        
        <div className="p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <p className="text-slate-500 font-medium mb-1">Average Base Salary</p>
              <p className="text-5xl font-black text-emerald-600">${salary.avgSalary.toLocaleString()}</p>
              <p className="text-sm text-slate-400 mt-2">/ year</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <p className="text-slate-500 font-medium mb-1">Active Job Openings</p>
              <p className="text-5xl font-black text-slate-800">{salary.jobCount.toLocaleString()}</p>
              <p className="text-sm text-slate-400 mt-2">in {salary.city} area</p>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Market Overview</h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            {salary.description || `The market for ${salary.profession}s in ${salary.city} is highly active. With an average base salary of $${salary.avgSalary.toLocaleString()}, it remains a competitive field in ${salary.state}. There are currently ${salary.jobCount} open positions actively recruiting.`}
          </p>
          
          <div className="mt-12 pt-8 border-t border-slate-100">
            <Link href="/" className="text-emerald-600 font-semibold hover:underline">← Back to Directory</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
