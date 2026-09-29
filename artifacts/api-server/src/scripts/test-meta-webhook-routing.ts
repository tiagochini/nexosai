import assert from "node:assert/strict";
import { extractMetaCommentChanges } from "../modules/social/meta-webhook.processor.js";

const instagram = extractMetaCommentChanges({
  object: "instagram",
  entry: [{
    id: "ig-account",
    changes: [{
      field: "comments",
      value: {
        comment_id: "comment-1",
        post_id: "post-1",
        parent_id: "parent-1",
        from: { id: "author-1", name: "Pessoa" },
        message: "Quero saber mais",
      },
    }],
  }],
});
assert.deepEqual(instagram, [{
  platform: "instagram",
  accountId: "ig-account",
  postId: "post-1",
  commentId: "comment-1",
  parentCommentId: "parent-1",
  authorId: "author-1",
  authorName: "Pessoa",
  text: "Quero saber mais",
}]);

const facebook = extractMetaCommentChanges({
  object: "page",
  entry: [{
    id: "page-1",
    changes: [{
      field: "feed",
      value: { item: "comment", comment_id: "comment-2", message: "Olá" },
    }],
  }],
});
assert.equal(facebook[0]?.platform, "facebook_page");
assert.equal(facebook[0]?.postId, "page-1");

assert.deepEqual(extractMetaCommentChanges({
  object: "instagram",
  entry: [{ id: "ig-account", changes: [{ field: "comments", value: {
    comment_id: "deleted", message: "removed", verb: "remove",
  } }] }],
}), [], "removed comments are ignored");

assert.deepEqual(extractMetaCommentChanges({
  object: "instagram",
  entry: [{ id: "ig-account", messaging: [{ message: { mid: "dm-1" } }] }],
}), [], "DM deliveries are not mistaken for comments");

console.log("Meta webhook routing contract passed");
