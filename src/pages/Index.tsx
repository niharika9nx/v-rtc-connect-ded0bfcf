import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="mb-4 text-5xl font-bold">Welcome to VBus</h1>
        <p className="text-xl text-muted-foreground">College Bus Transportation Management System</p>
        <div className="flex gap-4 justify-center">
          <Link to="/login">
            <Button size="lg">Login</Button>
          </Link>
          <Link to="/signup">
            <Button size="lg" variant="outline">Sign Up as Student</Button>
          </Link>
          <Link to="/signup-faculty">
            <Button size="lg" variant="outline">Sign Up as Faculty</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Index;
