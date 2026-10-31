export interface Destination {
  id: string;
  slug: string;
  name: string;
  region: string;
  category: string;
  summary: string;
  description?: string;
  tips?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  locationNote?: string;
  suggestedDays?: number | null;
  bestPeriod?: string | null;
  budgetEstimateMin?: string | null;
  budgetEstimateMax?: string | null;
  budgetNote?: string | null;
  activities?: string[];
  coverImageUrl?: string | null;
  images?: { url: string; alt: string; credit?: string | null }[];
  rating?: number | null;
  ratingCount?: number;
  tourCount?: number;
  tours?: TourCard[];
  accommodations?: StayCard[];
}

export interface TourCard {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  destinationName?: string;
  destinationSlug?: string;
  destination?: { name: string; slug?: string; region?: string };
  region?: string;
  category?: string;
  difficulty?: string;
  durationDays?: number;
  pricePerPerson?: string | null;
  currency?: string;
  coverImageUrl?: string | null;
  rating?: number | null;
  ratingCount?: number;
}

export interface TourDetail extends TourCard {
  description?: string;
  included?: string[];
  excluded?: string[];
  meetingPoint?: string;
  cancellationPolicy?: string;
  priceNote?: string;
  images?: { url: string; alt: string; credit?: string | null }[];
  destination?: { slug: string; name: string; region: string; latitude?: string | null; longitude?: string | null };
  guide?: { id: string; displayName: string; bio: string; languages: string[]; verified: boolean } | null;
  owner?: { name: string; telegram?: string | null; whatsapp?: string | null; phone?: string | null } | null;
  dates?: { id: string; startDate: string; endDate: string; remaining: number; capacity: number }[];
  reviews?: { id: string; rating: number; comment: string; author: string }[];
}

export interface StayCard {
  id: string;
  slug: string;
  name: string;
  type?: string;
  region?: string;
  summary?: string;
  description?: string;
  priceRangeMin?: string | null;
  priceRangeMax?: string | null;
  priceNote?: string | null;
  coverImageUrl?: string | null;
  verified?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
  services?: string[];
  latitude?: string | null;
  longitude?: string | null;
  images?: { url: string; alt: string }[];
  reviews?: { id: string; rating: number; comment: string; author: string }[];
}

export interface GuideCard {
  id: string;
  displayName: string;
  region: string;
  kind: string;
  specialties?: string[];
  bio?: string;
  languages?: string[];
  services?: string[];
  priceNote?: string | null;
  coverImageUrl?: string | null;
  verified?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
  reviews?: { id: string; rating: number; comment: string; author: string }[];
  yearsExperience?: number | null;
}

export interface HomePayload {
  popular: Destination[];
  trending: Destination[];
  weekend: Destination[];
  budget: Destination[];
  categories: string[];
  tours: TourCard[];
  guides: GuideCard[];
  accommodations: StayCard[];
}

export interface Reel {
  id: string;
  caption: string;
  destinationName: string;
  region: string;
  posterUrl: string;
  videoUrl: string;
  status: string;
  tourId: string | null;
  tourSlug: string | null;
  tourTitle: string | null;
  groupId: string | null;
  groupName: string | null;
  creator: string;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
}

export interface GroupCard {
  id: string;
  name: string;
  coverImageUrl: string | null;
  destinationName: string;
  region: string;
  description: string;
  departureDate: string | null;
  budgetPerPerson: string | null;
  desiredSize: number;
  memberCount: number;
  status: string;
  visibility: string;
  travelStyle: string | null;
  interests: string[];
}

export interface GroupProposal {
  id: string;
  tourId: string | null;
  tourSlug: string | null;
  title: string;
  operatorName: string;
  destinationName: string;
  pricePerPerson: string | null;
  durationDays: number;
  departureDate: string | null;
  included: string;
  excluded: string;
  custom: boolean;
  status: string;
  votes: number;
}

export interface GroupDetail extends GroupCard {
  rules: string | null;
  flexibleDates: boolean;
  departureTime: string | null;
  joinMode: string;
  isMember: boolean;
  isOrganizer: boolean;
  isOperator: boolean;
  myVote: string | null;
  seatsReserved: boolean;
  organizer: { firstName: string };
  members: { userId: string; firstName: string; role: string }[];
  joinRequests: { id: string; firstName: string; message: string | null; status: string }[];
  proposals: GroupProposal[];
  polls: { id: string; question: string; status: string; closedOptionId: string | null; options: { id: string; label: string; votes: number; mine: boolean }[] }[];
  summary: {
    popularTour: { id: string; title: string; votes: number } | null;
    preferredDate: { label: string; votes: number } | null;
    participants: number;
    estimatedTotal: string | null;
    selectedProposalId: string | null;
    seatsReserved: boolean;
    note: string;
  };
  contactRequests: { id: string; status: string; message: string; operatorFirstName: string; createdAt: string }[];
}

export interface GroupMessage {
  id: string;
  body: string;
  system: boolean;
  createdAt: string;
  sender: { firstName: string; mine: boolean } | null;
}

export interface ConversationCard {
  id: string;
  groupId: string | null;
  groupName: string | null;
  tourId: string | null;
  preview: string;
  with: string[];
}

export interface ConversationDetail {
  id: string;
  groupId: string | null;
  groupName: string | null;
  tourId: string | null;
  messages: { id: string; body: string; createdAt: string; mine: boolean; sender: string }[];
}

export interface InquiryCard {
  id: string;
  status: string;
  travelers: number;
  proposedPrice: string | null;
  currency: string;
  preferredDate: string | null;
  notes: string | null;
  groupId: string;
  groupName: string;
  tourSlug: string | null;
  tourTitle: string | null;
  incoming: boolean;
  seatsReserved: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  interests?: string[];
  preferredRegions?: string[];
  language: string;
  role: string;
  city?: string | null;
  showProfilePublicly: boolean;
  notifyBookings: boolean;
  notifyCompanions: boolean;
  notifyMarketing: boolean;
  telegramHandle?: string | null;
  whatsappHandle?: string | null;
  deletionRequestedAt?: string | null;
}

export interface BookingRecord {
  id: string;
  reference: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  travelers: number;
  pricePerPerson: string | null;
  totalPrice: string | null;
  currency: string;
  paymentStatus: string;
  paymentNote: string;
  startDate: string;
  endDate: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes?: string | null;
  travelerNames: string[];
  tour: { slug: string; title: string; coverImageUrl?: string | null; destinationName: string; destinationSlug: string };
}

export interface PlanResult {
  source: 'AI' | 'DEMO';
  title: string;
  days: {
    dayNumber: number;
    title: string;
    notes?: string | null;
    activities: {
      id?: string;
      title: string;
      placeName?: string | null;
      description: string;
      timeEstimateNote: string;
      transportNote?: string | null;
      estimatedCost?: string | null;
      tourId?: string | null;
      tourSlug?: string | null;
      sortOrder: number;
    }[];
  }[];
  totalEstimate: string;
  alternatives?: string | null;
  budgetShortfall?: boolean;
  packing: string[];
  assumptions: string[];
  disclaimer: string;
}
