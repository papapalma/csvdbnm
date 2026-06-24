import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import QR_Scanner_Modal from '../components/QR_Scanner_Modal';

/**
 * ScanPage Route Wrapper
 * 
 * This component serves as a route wrapper for the /scan route.
 * It renders the QR_Scanner_Modal and handles navigation when the modal is closed.
 * 
 * This maintains backward compatibility with existing navigation to /scan while
 * using the new modal component architecture.
 */
export default function ScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(true);
  
  // Extract initial state from route state
  const initialMode = location.state?.mode as 'item' | 'attendance' | undefined;
  const initialProgramId = location.state?.programId as string | undefined;
  const initialSessionId = location.state?.sessionId as string | undefined;
  
  useEffect(() => {
    // Open modal when route is accessed
    setIsOpen(true);
  }, []);
  
  const handleClose = () => {
    setIsOpen(false);
    // Small delay to allow modal close animation
    setTimeout(() => {
      navigate(-1); // Go back to previous page
    }, 200);
  };
  
  return (
    <QR_Scanner_Modal
      isOpen={isOpen}
      onClose={handleClose}
      initialMode={initialMode}
      initialProgramId={initialProgramId}
      initialSessionId={initialSessionId}
    />
  );
}
