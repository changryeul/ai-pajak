import React from 'react';
import { Button, Card, Badge } from '../components/ui';

interface LandingProps {
  onStart: () => void;
}

const Landing: React.FC<LandingProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
      <Card className="max-w-xl w-full p-10 text-center space-y-6">
        <Badge>AI Pajak</Badge>

        <h1 className="text-4xl font-black">
          AI-Driven Tax Filing
        </h1>

        <p className="text-slate-400">
          OCR → AI Analysis → Human Review → Filing
        </p>

        <Button
  size="lg"
  onClick={() => {
    alert('🔥 BUTTON CLICKED');
    onStart();
  }}
>
  Start Filing
</Button>
      </Card>
    </div>
  );
};

export default Landing;