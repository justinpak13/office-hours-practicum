import React, { ReactElement } from "react";
import { API } from "@koh/api-client";
import useSWR from "swr";
import styled from "styled-components";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const Row = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  font-size: 18px;
  align-items: center;
  margin-bottom: 16px;
`;

export default function InsightsDisplayOptions(): ReactElement {
  const { data: profile, mutate: mutateProfile } = useSWR(
    `api/v1/profile`,
    async () => API.profile.index()
  );
  const { data: insightsList } = useSWR(`api/v1/insights`, async () =>
    API.insights.list()
  );

  const toggleInsightOnOrOff = async (
    checked: boolean,
    insightName: string
  ) => {
    if (checked) {
      await API.insights.toggleOn(insightName);
    } else {
      await API.insights.toggleOff(insightName);
    }
    mutateProfile();
  };

  return (
    <>
      <div>
        {insightsList &&
          Object.entries(insightsList)?.map(([insightName, insightPartial]) => (
            <div key={insightName}>
              <Row>
                <div>{insightPartial.displayName}</div>
                <Switch
                  aria-label={insightPartial.displayName}
                  checked={!!profile?.insights?.includes(insightName)}
                  onCheckedChange={(checked) =>
                    toggleInsightOnOrOff(checked, insightName)
                  }
                />
              </Row>
              {/* antd's Divider: 24px above and below */}
              <Separator className="my-6" />
            </div>
          ))}
      </div>
    </>
  );
}
