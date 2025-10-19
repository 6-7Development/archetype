import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Star, ThumbsUp, CheckCircle, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateReviewsProps {
  templateId: string;
  userPurchased?: boolean;
}

interface Review {
  id: string;
  userId: string;
  rating: number;
  title?: string;
  comment?: string;
  isVerifiedPurchase: number;
  helpfulCount: number;
  createdAt: string;
  userFirstName?: string;
  userLastName?: string;
  userProfileImage?: string;
}

export function TemplateReviews({ templateId, userPurchased = false }: TemplateReviewsProps) {
  const [showAddReview, setShowAddReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const { toast } = useToast();

  const { data: reviewsData } = useQuery<{ reviews: Review[] }>({
    queryKey: [`/api/templates/${templateId}/reviews`],
  });

  const createReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; title?: string; comment?: string }) => {
      return await apiRequest("POST", `/api/templates/${templateId}/reviews`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/templates/${templateId}/reviews`] });
      setShowAddReview(false);
      setRating(5);
      setTitle("");
      setComment("");
      toast({ title: "Review submitted successfully" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", description: error.message });
    }
  });

  const updateReviewMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { rating?: number; title?: string; comment?: string } }) => {
      return await apiRequest("PUT", `/api/reviews/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/templates/${templateId}/reviews`] });
      setEditingReview(null);
      toast({ title: "Review updated" });
    }
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/reviews/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/templates/${templateId}/reviews`] });
      toast({ title: "Review deleted" });
    }
  });

  const helpfulMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/reviews/${id}/helpful`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/templates/${templateId}/reviews`] });
    }
  });

  const handleSubmitReview = () => {
    if (rating < 1 || rating > 5) {
      toast({ variant: "destructive", description: "Please select a rating" });
      return;
    }
    createReviewMutation.mutate({ rating, title, comment });
  };

  const handleUpdateReview = () => {
    if (!editingReview) return;
    updateReviewMutation.mutate({
      id: editingReview.id,
      data: { rating, title, comment }
    });
  };

  const reviews = reviewsData?.reviews || [];
  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
    : 0;

  const StarRating = ({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange && onChange(star)}
          className={cn(
            "transition-colors",
            readonly && "cursor-default"
          )}
          data-testid={`star-${star}`}
        >
          <Star
            className={cn(
              "w-5 h-5",
              star <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
            )}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Reviews & Ratings</CardTitle>
              <CardDescription>
                {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
                {reviews.length > 0 && ` · ${averageRating.toFixed(1)} average rating`}
              </CardDescription>
            </div>
            <Dialog open={showAddReview} onOpenChange={setShowAddReview}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-write-review">
                  <Star className="w-4 h-4 mr-2" />
                  Write Review
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Write a Review</DialogTitle>
                  <DialogDescription>
                    Share your experience with this template
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Rating</Label>
                    <StarRating value={rating} onChange={setRating} />
                  </div>
                  <div>
                    <Label htmlFor="review-title">Title (optional)</Label>
                    <Input
                      id="review-title"
                      data-testid="input-review-title"
                      placeholder="Great template!"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="review-comment">Comment (optional)</Label>
                    <Textarea
                      id="review-comment"
                      data-testid="input-review-comment"
                      placeholder="Tell us what you think..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <Button
                    onClick={handleSubmitReview}
                    disabled={createReviewMutation.isPending}
                    data-testid="button-submit-review"
                    className="w-full"
                  >
                    {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No reviews yet. Be the first to review!
              </p>
            ) : (
              reviews.map((review) => (
                <Card key={review.id} className="p-4" data-testid={`review-${review.id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {review.userProfileImage ? (
                          <img src={review.userProfileImage} alt="" className="w-10 h-10 rounded-full" />
                        ) : (
                          <span className="text-sm font-medium">
                            {review.userFirstName?.[0]}{review.userLastName?.[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">
                            {review.userFirstName} {review.userLastName}
                          </p>
                          {review.isVerifiedPurchase === 1 && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Verified Purchase
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StarRating value={review.rating} readonly />
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {review.title && (
                    <h4 className="font-medium mb-1" data-testid={`review-title-${review.id}`}>
                      {review.title}
                    </h4>
                  )}
                  {review.comment && (
                    <p className="text-sm text-muted-foreground mb-3" data-testid={`review-comment-${review.id}`}>
                      {review.comment}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => helpfulMutation.mutate(review.id)}
                      data-testid={`button-helpful-${review.id}`}
                    >
                      <ThumbsUp className="w-4 h-4 mr-1" />
                      Helpful ({review.helpfulCount})
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
