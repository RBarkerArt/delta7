import React from 'react';
import { HeartHandshake } from 'lucide-react';

const SUPPORT_LINKS = [
    {
        title: 'A Moment of Holding',
        body: 'A small one-time gesture that helps the signal continue without changing access.',
        href: 'https://buy.stripe.com/4gMeVea4hgOe81feq6eIw02',
        label: 'Offer a Moment'
    },
    {
        title: 'Keep Watch',
        body: 'A steady contribution for those who want the project to remain online between transmissions.',
        href: 'https://buy.stripe.com/eVqcN6foB7dEa9neq6eIw01',
        label: 'Keep Watch'
    },
    {
        title: 'Hold the Line',
        body: 'Longer-term support for the cost of keeping the room, archives, and feed alive.',
        href: 'https://buy.stripe.com/5kQfZi0tH55wchveq6eIw00',
        label: 'Hold the Line'
    }
];

export const SupportRelayPanel: React.FC = () => {
    return (
        <div className="space-y-5 text-[#f7f1dc]">
            <div className="flex items-start gap-4 border-l border-emerald-200/25 pl-4">
                <HeartHandshake size={20} className="mt-0.5 shrink-0 text-emerald-100/72" />
                <div className="space-y-2 text-sm leading-relaxed text-[#f7f1dc]/84">
                    <p>This relay exists only to help the project continue.</p>
                    <p>Nothing is locked behind support. Nothing changes in the archive. The room simply stays easier to keep open.</p>
                </div>
            </div>

            <div className="grid gap-3">
                {SUPPORT_LINKS.map(link => (
                    <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block border border-[#f2ead0]/14 bg-black/24 p-4 transition-colors hover:border-emerald-100/32 hover:bg-emerald-100/12"
                    >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#fff7df]">
                            {link.title}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-[#f7f1dc]/72">
                            {link.body}
                        </p>
                        <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-50/82">
                            {link.label}
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};
