import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountSetupStatus, TreasuryDistributionStatus } from "@prisma/client";
import CreateProposalClient from "./create-proposal-client";

type CreateProposalPageProps = {
  searchParams?: Promise<{
    from?: string;
  }>;
};

type AccountReadinessProps = {
  isCheckingAccount: boolean;
  isAccountReadyFromAppState: boolean;
  walletAddress: `0x${string}` | null;
};

async function getAccountReadiness(): Promise<AccountReadinessProps> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      isCheckingAccount: false,
      isAccountReadyFromAppState: false,
      walletAddress: null,
    };
  }

  const setupUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      accountSetupStatus: true,
      initialAllocationStatus: true,
      walletAddress: true,
    },
  });

  const isAccountReadyFromAppState =
    setupUser?.initialAllocationStatus ===
      TreasuryDistributionStatus.SUCCEEDED ||
    setupUser?.accountSetupStatus === AccountSetupStatus.READY;

  const walletAddress =
    typeof setupUser?.walletAddress === "string" &&
    setupUser.walletAddress.startsWith("0x")
      ? (setupUser.walletAddress as `0x${string}`)
      : null;

  return {
    isCheckingAccount: false,
    isAccountReadyFromAppState,
    walletAddress,
  };
}

export default async function CreateProposalPage({
  searchParams,
}: CreateProposalPageProps) {
  const params = await searchParams;

  const origin =
    params?.from === "dashboard" || params?.from === "proposals"
      ? params.from
      : "proposals";

  const accountReadiness = await getAccountReadiness();

  return (
    <CreateProposalClient
      origin={origin}
      accountReadiness={{
        isCheckingAccount: accountReadiness.isCheckingAccount,
        isAccountReadyFromAppState: accountReadiness.isAccountReadyFromAppState,
      }}
      walletAddress={accountReadiness.walletAddress}
    />
  );
}
