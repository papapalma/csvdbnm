import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Home, ArrowLeft, FileQuestion } from 'lucide-react';

export default function NotFoundPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="flex flex-col items-center py-12 text-center">
          {/* 404 Icon */}
          <div className="mb-6 flex size-32 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="size-16 text-muted-foreground" />
          </div>

          {/* Error Code */}
          <div className="mb-3">
            <h1 className="mb-2 text-6xl md:text-8xl">404</h1>
            <h2>Page Not Found</h2>
          </div>

          {/* Message */}
          <p className="mb-8 text-muted-foreground max-w-md">
            Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row w-full sm:w-auto">
            <Button variant="outline" onClick={() => window.history.back()} className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 size-4" />
              Go Back
            </Button>
            <Link to={isAuthenticated ? '/dashboard' : '/'} className="w-full sm:w-auto">
              <Button className="w-full">
                <Home className="mr-2 size-4" />
                {isAuthenticated ? 'Go to Dashboard' : 'Go to Home'}
              </Button>
            </Link>
          </div>

          {/* Help Text */}
          <div className="mt-8 text-sm text-muted-foreground">
            <p>If you believe this is an error, please contact support.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
