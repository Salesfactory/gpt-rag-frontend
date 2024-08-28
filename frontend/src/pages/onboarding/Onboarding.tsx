import React, { useState } from 'react';

const Onboarding: React.FC = () => {
    const [organization, setOrganization] = useState('');

    const handleOrganizationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setOrganization(event.target.value);
    };

    return (
        <div>
            <h1>Welcome to Freddaid!</h1>
            <p>Let's get started with onboarding.</p>
        </div>
    );
};

export default Onboarding;