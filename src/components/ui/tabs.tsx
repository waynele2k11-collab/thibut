"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function sanitizeDomSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function computeNextTabValue(
  orderedValues: readonly string[],
  currentValue: string,
  key: string
): string | null {
  if (orderedValues.length === 0) return null;
  const currentIndex = orderedValues.indexOf(currentValue);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  switch (key) {
    case "ArrowRight":
      return orderedValues[(safeIndex + 1) % orderedValues.length] ?? null;
    case "ArrowLeft":
      return (
        orderedValues[
          (safeIndex - 1 + orderedValues.length) % orderedValues.length
        ] ?? null
      );
    case "Home":
      return orderedValues[0] ?? null;
    case "End":
      return orderedValues[orderedValues.length - 1] ?? null;
    default:
      return null;
  }
}

interface TriggerRegistration {
  value: string;
  element: HTMLButtonElement | null;
  disabled: boolean;
}

interface TabsContextValue {
  baseId: string;
  value: string;
  onValueChange: (value: string) => void;
  registerTrigger: (value: string, element: HTMLButtonElement | null, disabled: boolean) => void;
  getOrderedTriggers: () => TriggerRegistration[];
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const baseId = React.useId();
  const [uncontrolledTab, setUncontrolledTab] = React.useState(defaultValue ?? "");
  const triggersRef = React.useRef<TriggerRegistration[]>([]);

  const activeTab = value !== undefined ? value : uncontrolledTab;

  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setUncontrolledTab(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [value, onValueChange]
  );

  const registerTrigger = React.useCallback(
    (tabValue: string, element: HTMLButtonElement | null, disabled: boolean) => {
      if (!element) {
        triggersRef.current = triggersRef.current.filter((item) => item.value !== tabValue);
        return;
      }
      const existingIdx = triggersRef.current.findIndex((item) => item.value === tabValue);
      if (existingIdx >= 0) {
        triggersRef.current[existingIdx] = { value: tabValue, element, disabled };
      } else {
        triggersRef.current.push({ value: tabValue, element, disabled });
      }
    },
    []
  );

  const getOrderedTriggers = React.useCallback(() => {
    return triggersRef.current.filter((item) => !item.disabled);
  }, []);

  const contextValue = React.useMemo<TabsContextValue>(
    () => ({
      baseId,
      value: activeTab,
      onValueChange: handleValueChange,
      registerTrigger,
      getOrderedTriggers,
    }),
    [baseId, activeTab, handleValueChange, registerTrigger, getOrderedTriggers]
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.ComponentPropsWithRef<"div"> {
  "aria-label"?: string;
}

export function TabsList({ className, children, ref, ...props }: TabsListProps) {
  return (
    <div
      ref={ref}
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-lg bg-surface-container border border-surface-variant p-1 text-on-surface-variant",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends Omit<React.ComponentPropsWithRef<"button">, "value"> {
  value: string;
}

export function TabsTrigger({
  value,
  className,
  children,
  disabled = false,
  onClick,
  onKeyDown,
  ref,
  ...props
}: TabsTriggerProps) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsTrigger must be used within Tabs");
  }

  const isActive = context.value === value;
  const safeSegment = sanitizeDomSegment(value);
  const tabId = `${context.baseId}-tab-${safeSegment}`;
  const panelId = `${context.baseId}-panel-${safeSegment}`;

  const setRefs = React.useCallback(
    (node: HTMLButtonElement | null) => {
      context.registerTrigger(value, node, Boolean(disabled));
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [context, value, disabled, ref]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    const tablistElement = event.currentTarget?.closest?.('[role="tablist"]');
    if (tablistElement) {
      const domButtons = Array.from(
        tablistElement.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
      );
      const domValues = domButtons
        .map((btn) => btn.getAttribute("data-tab-value") ?? "")
        .filter((v) => v.length > 0);
      const nextValue = computeNextTabValue(domValues, value, event.key);
      if (nextValue !== null) {
        event.preventDefault();
        const nextBtn = domButtons.find(
          (btn) => btn.getAttribute("data-tab-value") === nextValue
        );
        nextBtn?.focus();
        context.onValueChange(nextValue);
        return;
      }
    }

    const registered = context.getOrderedTriggers();
    const registeredValues = registered.map((item) => item.value);
    const nextValue = computeNextTabValue(registeredValues, value, event.key);
    if (nextValue !== null) {
      event.preventDefault();
      const target = registered.find((item) => item.value === nextValue);
      target?.element?.focus();
      context.onValueChange(nextValue);
    }
  };

  return (
    <button
      ref={setRefs}
      id={tabId}
      type="button"
      role="tab"
      data-tab-value={value}
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context.onValueChange(value);
        }
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded px-3.5 py-2 font-label-caps text-label-caps uppercase transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:pointer-events-none disabled:opacity-50",
        isActive
          ? "bg-surface-container-lowest text-primary border border-outline-variant"
          : "text-on-surface-variant border border-transparent hover:text-primary",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends React.ComponentPropsWithRef<"div"> {
  value: string;
}

export function TabsContent({
  value,
  className,
  children,
  ref,
  ...props
}: TabsContentProps) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error("TabsContent must be used within Tabs");
  }

  if (context.value !== value) {
    return null;
  }

  const safeSegment = sanitizeDomSegment(value);
  const tabId = `${context.baseId}-tab-${safeSegment}`;
  const panelId = `${context.baseId}-panel-${safeSegment}`;

  return (
    <div
      ref={ref}
      id={panelId}
      role="tabpanel"
      aria-labelledby={tabId}
      tabIndex={0}
      className={cn(
        "mt-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
