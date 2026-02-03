import React from 'react';
import { useNavigate } from 'react-router-dom';

interface LegalPageProps {
    title: string;
    content: React.ReactNode;
}

const LegalPage: React.FC<LegalPageProps> = ({ title, content }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-black text-[#10b981] font-mono p-8 md:p-16 flex flex-col items-center">
            <div className="max-w-4xl w-full">
                <button
                    onClick={() => navigate('/')}
                    className="mb-12 flex items-center gap-2 hover:opacity-70 transition-opacity border border-[#10b98133] px-4 py-2 text-sm tracking-widest"
                >
                    <span className="text-xl">←</span> RETURN TO OBSERVATIONS
                </button>

                <div className="border-b border-[#10b98133] pb-4 mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-[0.2em] uppercase">
                        {title}
                    </h1>
                </div>

                <div className="prose prose-invert max-w-none font-mono text-sm md:text-base leading-relaxed space-y-8">
                    {content}
                </div>

                <div className="mt-20 pt-8 border-t border-[#10b98111] text-xs opacity-40 text-right tracking-[0.3em]">
                    PROTOCOL_STATUS: VERIFIED // DELTA-7 LEGAL
                </div>
            </div>
        </div>
    );
};

export const PrivacyStatement = () => (
    <LegalPage
        title="Privacy Statement"
        content={
            <div className="space-y-8">
                <section>
                    <h2 className="text-xl border-l-2 border-[#10b981] pl-4 mb-4">1. DATA OVERVIEW</h2>
                    <p>
                        The Delta-7 project ("System", "We") operates as an observation platform. By interacting with the System, you agree to the protocols defined herein. We value the integrity of your data and the coherence of the collective observation.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl border-l-2 border-[#10b981] pl-4 mb-4">2. INFORMATION WE TRACK</h2>
                    <p>
                        We collect limited information to maintain System stability and individual observer identification:
                    </p>
                    <ul className="list-disc pl-8 space-y-2">
                        <li><strong>Observer Signals (Account Info):</strong> Emails and authentication tokens provided during the "Anchoring" process.</li>
                        <li><strong>Usage Data (Gtags):</strong> We utilize Google Analytics (Google Global Site Tag) to monitor System traffic, coherence levels, and observer navigation patterns.</li>
                        <li><strong>Visitor Identification:</strong> Anonymous IDs are assigned to track progression across observation cycles.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl border-l-2 border-[#10b981] pl-4 mb-4">3. TRANSACTIONAL SECURITY (STRIPE)</h2>
                    <p>
                        Financial contributions and transactions within the System are processed exclusively through <strong>Stripe</strong>.
                        We do not store or process your credit card numbers on our local servers. Stripe collects and processes your payment details according to their own privacy standards.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl border-l-2 border-[#10b981] pl-4 mb-4">4. ARCHIVAL USAGE</h2>
                    <p>
                        Archived narrative data and observer contributions may be maintained to ensure chronological consistency of the Delta-7 record. You may request account deletion at any time via the System interface.
                    </p>
                </section>
            </div>
        }
    />
);

export const TermsAndConditions = () => (
    <LegalPage
        title="Terms and Conditions"
        content={
            <div className="space-y-8">
                <section>
                    <h2 className="text-xl border-l-2 border-[#10b981] pl-4 mb-4">1. PROTOCOL ACCEPTANCE</h2>
                    <p>
                        By accessing the Delta-7 Terminal, you acknowledge that you are entering an observation sequence. Your presence within the coherence requires adherence to these terms.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl border-l-2 border-[#10b981] pl-4 mb-4">2. OBSERVER CONDUCT</h2>
                    <p>
                        Observers agree not to disrupt the coherence through automated scraping, denial of service attempts, or unauthorized signal manipulation. Any attempt to bypass System barriers may result in permanent signal isolation (account termination).
                    </p>
                </section>

                <section>
                    <h2 className="text-xl border-l-2 border-[#10b981] pl-4 mb-4">3. INTELLECTUAL PROPERTY</h2>
                    <p>
                        All narrative content, visual assets, and Dr. Kael's transmissions are protected under the Delta-7 project protocols. Redistribution of sensitive System logs without authorization is strictly prohibited.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl border-l-2 border-[#10b981] pl-4 mb-4">4. LIMITATION OF LIABILITY</h2>
                    <p>
                        The Delta-7 project provides an immersive narrative experience. We are not liable for any loss of digital assets, coherence drift, or psychological impact resulting from the observation of fragmented reality.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl border-l-2 border-[#10b981] pl-4 mb-4">5. THIRD-PARTY SERVICES</h2>
                    <p>
                        By utilizing the System, you agree to interact with third-party sub-processors including <strong>Stripe</strong> (Payment Processing) and <strong>Google Cloud</strong> (Infrastructure and Analytics).
                    </p>
                </section>
            </div>
        }
    />
);

export default LegalPage;
