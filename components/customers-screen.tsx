"use client";

import { useEffect, useState } from "react";
import { fetchAction } from "@/lib/client";
import type { CustomersData } from "@/lib/types";
import { formatHours } from "@/lib/utils";
import { EmptyState, LoadingState, Panel } from "@/components/ui";

export function CustomersScreen() {
  const [payload, setPayload] = useState<CustomersData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const response = await fetchAction<CustomersData>("customers");
      setPayload(response.data);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <LoadingState label="Loading customers..." />;
  }

  if (!payload) {
    return <EmptyState title="Customers unavailable" copy="Customer summaries could not be loaded." />;
  }

  return (
    <div className="screen-stack screen-stack--single">
      <Panel>
        <div className="panel-title-row">
          <div>
            <h2 className="panel-title">Customer View</h2>
            <p className="panel-subtitle">Customer-wise distribution of tasks and hours.</p>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="list-stack">
          {payload.customers.length === 0 ? (
            <EmptyState title="No customer records" copy="Your assigned task list does not include customers yet." />
          ) : (
            payload.customers.map((customer) => (
              <article key={customer.customerId} className="list-card">
                <div className="customer-summary-row">
                  <div className="list-head-copy">
                    <h3 className="list-title">{customer.customerName}</h3>
                    <p className="panel-subtitle">{customer.customerGroup}</p>
                  </div>
                  <span className="badge badge-assigned">{formatHours(customer.totalHours)}</span>
                </div>

                <div className="metric-grid metric-grid--customer toolbar-row">
                  <article className="metric-card">
                    <span className="metric-label">Tasks</span>
                    <span className="metric-value">{customer.taskCount}</span>
                  </article>
                  <article className="metric-card">
                    <span className="metric-label">Pending</span>
                    <span className="metric-value">{customer.pending}</span>
                  </article>
                  <article className="metric-card">
                    <span className="metric-label">Progress</span>
                    <span className="metric-value">{customer.inProgress}</span>
                  </article>
                  <article className="metric-card">
                    <span className="metric-label">Done</span>
                    <span className="metric-value">{customer.completed}</span>
                  </article>
                </div>
              </article>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
