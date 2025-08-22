import React from 'react';
import { useAppContext } from '../providers/AppProviders';

const SubscriptionError: React.FC = () => {
    const { subscriptionError } = useAppContext();
    return (
        <div
        style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
        }}
        >
            <h1>Subscription Error</h1>
            <p>{subscriptionError}</p>
            <p>Please contact Technical Support to resolve this issue.</p>
        </div>
    );
};

export default SubscriptionError;