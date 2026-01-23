import { useContext } from 'react';
import { CoherenceContext } from '../context/contexts';

export const useCoherence = () => {
    const context = useContext(CoherenceContext);
    if (context === undefined) {
        throw new Error('useCoherence must be used within a CoherenceProvider');
    }
    return context;
};
