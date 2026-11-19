class AppBranding {
  const AppBranding(
      {required this.siteName, required this.appName, required this.logoUrl});
  final String siteName, appName, logoUrl;
  static const fallback = AppBranding(
      siteName: 'Northstar Learning', appName: 'Northstar', logoUrl: '');

  factory AppBranding.fromJson(Map<String, dynamic> json, String apiOrigin) {
    final rawLogo = json['logoUrl'] is String ? json['logoUrl'] as String : '';
    final logoUrl =
        rawLogo.isEmpty ? '' : Uri.parse(apiOrigin).resolve(rawLogo).toString();
    return AppBranding(
        siteName: json['siteName'] ?? 'Northstar Learning',
        appName: json['appName'] ?? json['siteName'] ?? 'Northstar',
        logoUrl: logoUrl);
  }
}

class Student {
  const Student(
      {required this.id,
      required this.firstName,
      required this.lastName,
      required this.email,
      required this.phone,
      required this.status});
  final String id, firstName, lastName, email, phone, status;
  factory Student.fromJson(Map<String, dynamic> json) => Student(
      id: json['id'] ?? '',
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      status: json['status'] ?? 'Active');
}

class TutorialVideo {
  const TutorialVideo(
      {required this.id,
      required this.title,
      required this.provider,
      required this.sourceUrl,
      required this.durationMinutes,
      required this.progressSeconds,
      required this.durationSeconds,
      required this.completed});
  final String id, title, provider, sourceUrl;
  final int durationMinutes, progressSeconds, durationSeconds;
  final bool completed;
  factory TutorialVideo.fromJson(Map<String, dynamic> json) => TutorialVideo(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      provider: json['provider'] ?? '',
      sourceUrl: json['sourceUrl'] ?? '',
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 0,
      progressSeconds: (json['progressSeconds'] as num?)?.toInt() ?? 0,
      durationSeconds: (json['durationSeconds'] as num?)?.toInt() ?? 0,
      completed: json['completed'] == true);
}

class TutorialChapter {
  const TutorialChapter(
      {required this.id, required this.title, required this.videos});
  final String id, title;
  final List<TutorialVideo> videos;
  factory TutorialChapter.fromJson(Map<String, dynamic> json) =>
      TutorialChapter(
          id: json['id'] ?? '',
          title: json['title'] ?? '',
          videos: ((json['videos'] as List?) ?? [])
              .map((item) => TutorialVideo.fromJson(item))
              .toList());
}

class TutorialAttachment {
  const TutorialAttachment(
      {required this.id,
      required this.name,
      required this.url,
      required this.sizeBytes,
      required this.mimeType});
  final String id, name, url, mimeType;
  final int sizeBytes;
  factory TutorialAttachment.fromJson(Map<String, dynamic> json) =>
      TutorialAttachment(
          id: json['id'] ?? '',
          name: json['name'] ?? '',
          url: json['url'] ?? '',
          sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
          mimeType: json['mimeType'] ?? 'application/octet-stream');
}

class TutorialReview {
  const TutorialReview(
      {required this.id,
      required this.studentName,
      required this.rating,
      required this.comment,
      required this.updatedAt});
  final String id, studentName, comment, updatedAt;
  final int rating;
  factory TutorialReview.fromJson(Map<String, dynamic> json) => TutorialReview(
      id: json['id'] ?? '',
      studentName: json['studentName'] ?? 'Student',
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      comment: json['comment'] ?? '',
      updatedAt: json['updatedAt'] ?? '');
}

class SupportQuery {
  const SupportQuery({
    required this.id,
    required this.referenceNumber,
    required this.subject,
    required this.message,
    required this.status,
    required this.adminReply,
    required this.createdAt,
    required this.updatedAt,
  });
  final String id, referenceNumber, subject, message, status, adminReply;
  final String createdAt, updatedAt;
  factory SupportQuery.fromJson(Map<String, dynamic> json) => SupportQuery(
        id: json['id'] ?? '',
        referenceNumber: json['referenceNumber'] ?? '',
        subject: json['subject'] ?? '',
        message: json['message'] ?? '',
        status: json['status'] ?? 'Open',
        adminReply: json['adminReply'] ?? '',
        createdAt: json['createdAt'] ?? '',
        updatedAt: json['updatedAt'] ?? '',
      );
}

class Tutorial {
  const Tutorial(
      {required this.id,
      required this.title,
      required this.category,
      required this.thumbnailUrl,
      required this.featured,
      required this.progressPercent,
      required this.completedVideoCount,
      required this.attachments,
      required this.reviews,
      required this.chapters});
  final String id, title, category, thumbnailUrl;
  final bool featured;
  final int progressPercent, completedVideoCount;
  final List<TutorialAttachment> attachments;
  final List<TutorialReview> reviews;
  final List<TutorialChapter> chapters;
  int get videoCount =>
      chapters.fold(0, (total, chapter) => total + chapter.videos.length);
  factory Tutorial.fromJson(Map<String, dynamic> json) => Tutorial(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      category: json['category'] ?? '',
      thumbnailUrl: json['thumbnailUrl'] ?? '',
      featured: json['featured'] == true,
      progressPercent:
          ((json['progressPercent'] as num?)?.toInt() ?? 0).clamp(0, 100),
      completedVideoCount: (json['completedVideoCount'] as num?)?.toInt() ?? 0,
      attachments: ((json['attachments'] as List?) ?? [])
          .map((item) => TutorialAttachment.fromJson(item))
          .toList(),
      reviews: ((json['reviews'] as List?) ?? [])
          .map((item) => TutorialReview.fromJson(item))
          .toList(),
      chapters: ((json['chapters'] as List?) ?? [])
          .map((item) => TutorialChapter.fromJson(item))
          .toList());
}
