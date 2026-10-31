-- CreateEnum
CREATE TYPE "GroupVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "GroupJoinMode" AS ENUM ('OPEN', 'REQUEST');

-- CreateEnum
CREATE TYPE "GroupMemberRole" AS ENUM ('ORGANIZER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('OPEN', 'SELECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('DRAFT', 'PENDING', 'CONTACTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VideoModeration" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "preferredRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TravelGroup" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "destinationName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "departureDate" DATE,
    "departureTime" TEXT,
    "flexibleDates" BOOLEAN NOT NULL DEFAULT false,
    "budgetPerPerson" DECIMAL(12,2),
    "desiredSize" INTEGER NOT NULL,
    "travelStyle" TEXT,
    "visibility" "GroupVisibility" NOT NULL DEFAULT 'PUBLIC',
    "joinMode" "GroupJoinMode" NOT NULL DEFAULT 'REQUEST',
    "rules" TEXT,
    "interests" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "selectedProposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupJoinRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" "JoinStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMessage" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "senderId" TEXT,
    "body" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourProposal" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tourId" TEXT,
    "proposerId" TEXT NOT NULL,
    "operatorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "pricePerPerson" DECIMAL(12,2) NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "departureDate" DATE,
    "included" TEXT NOT NULL,
    "excluded" TEXT NOT NULL,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProposalStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourVote" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatePoll" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" "PollStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "closedOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatePoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatePollOption" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "date" DATE,

    CONSTRAINT "DatePollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatePollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatePollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "tourId" TEXT,
    "message" TEXT NOT NULL,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "contactRequestId" TEXT,
    "groupId" TEXT,
    "tourId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupInquiry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "tourId" TEXT,
    "proposalId" TEXT,
    "travelers" INTEGER NOT NULL,
    "preferredDate" DATE,
    "proposedPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'TJS',
    "notes" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'PENDING',
    "statusHistory" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelVideo" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "tourId" TEXT,
    "groupId" TEXT,
    "status" "VideoModeration" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoLike" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoComment" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedVideo" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelGroup_visibility_status_region_idx" ON "TravelGroup"("visibility", "status", "region");

-- CreateIndex
CREATE INDEX "GroupMembership_userId_idx" ON "GroupMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupId_userId_key" ON "GroupMembership"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupJoinRequest_groupId_userId_key" ON "GroupJoinRequest"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "TourProposal_groupId_status_idx" ON "TourProposal"("groupId", "status");

-- CreateIndex
CREATE INDEX "TourVote_proposalId_idx" ON "TourVote"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "TourVote_groupId_userId_key" ON "TourVote"("groupId", "userId");

-- CreateIndex
CREATE INDEX "DatePoll_groupId_idx" ON "DatePoll"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "DatePollVote_pollId_userId_key" ON "DatePollVote"("pollId", "userId");

-- CreateIndex
CREATE INDEX "ContactRequest_groupId_status_idx" ON "ContactRequest"("groupId", "status");

-- CreateIndex
CREATE INDEX "ContactRequest_operatorId_createdAt_idx" ON "ContactRequest"("operatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_contactRequestId_key" ON "Conversation"("contactRequestId");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "GroupInquiry_operatorId_status_idx" ON "GroupInquiry"("operatorId", "status");

-- CreateIndex
CREATE INDEX "GroupInquiry_organizerId_idx" ON "GroupInquiry"("organizerId");

-- CreateIndex
CREATE INDEX "TravelVideo_status_createdAt_idx" ON "TravelVideo"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VideoLike_videoId_userId_key" ON "VideoLike"("videoId", "userId");

-- CreateIndex
CREATE INDEX "VideoComment_videoId_createdAt_idx" ON "VideoComment"("videoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedVideo_videoId_userId_key" ON "SavedVideo"("videoId", "userId");

-- CreateIndex
CREATE INDEX "ContentReport_status_targetType_idx" ON "ContentReport"("status", "targetType");

-- AddForeignKey
ALTER TABLE "TravelGroup" ADD CONSTRAINT "TravelGroup_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupJoinRequest" ADD CONSTRAINT "GroupJoinRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupJoinRequest" ADD CONSTRAINT "GroupJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMessage" ADD CONSTRAINT "GroupMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourProposal" ADD CONSTRAINT "TourProposal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourProposal" ADD CONSTRAINT "TourProposal_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourProposal" ADD CONSTRAINT "TourProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourVote" ADD CONSTRAINT "TourVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TourProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TourVote" ADD CONSTRAINT "TourVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePoll" ADD CONSTRAINT "DatePoll_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePollOption" ADD CONSTRAINT "DatePollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "DatePoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePollVote" ADD CONSTRAINT "DatePollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "DatePollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatePollVote" ADD CONSTRAINT "DatePollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_contactRequestId_fkey" FOREIGN KEY ("contactRequestId") REFERENCES "ContactRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInquiry" ADD CONSTRAINT "GroupInquiry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInquiry" ADD CONSTRAINT "GroupInquiry_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInquiry" ADD CONSTRAINT "GroupInquiry_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInquiry" ADD CONSTRAINT "GroupInquiry_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelVideo" ADD CONSTRAINT "TravelVideo_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelVideo" ADD CONSTRAINT "TravelVideo_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "Tour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelVideo" ADD CONSTRAINT "TravelVideo_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TravelGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLike" ADD CONSTRAINT "VideoLike_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "TravelVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoLike" ADD CONSTRAINT "VideoLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoComment" ADD CONSTRAINT "VideoComment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "TravelVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoComment" ADD CONSTRAINT "VideoComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedVideo" ADD CONSTRAINT "SavedVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "TravelVideo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedVideo" ADD CONSTRAINT "SavedVideo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentReport" ADD CONSTRAINT "ContentReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
