import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import PublicForm from "@/pages/PublicForm";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Admin = lazy(() => import("@/pages/Admin"));
function AdminRoute() { return <Suspense fallback={<div className="min-h-screen grid place-items-center bg-[#f7f6f2] text-[#1e2927]">読み込み中…</div>}><Admin /></Suspense>; }
function Router() { return <Switch><Route path="/" component={Home}/><Route path="/f/:slug" component={PublicForm}/><Route path="/manage" component={AdminRoute}/><Route path="/404" component={NotFound}/><Route component={NotFound}/></Switch>; }
export default function App() { return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster/><Router/></TooltipProvider></ThemeProvider></ErrorBoundary>; }
