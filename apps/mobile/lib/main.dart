import 'package:flutter/material.dart';
import 'student_app.dart' as student_app;

void main() => student_app.start();

class NorthstarApp extends StatelessWidget {
  const NorthstarApp({super.key});

  @override
  Widget build(BuildContext context) {
    const green = Color(0xFF18392B);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Northstar Learning',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: green, primary: green),
        scaffoldBackgroundColor: const Color(0xFFFAF8F3),
        useMaterial3: true,
        fontFamily: 'sans-serif',
      ),
      home: const StudentHomePage(),
    );
  }
}

class StudentHomePage extends StatelessWidget {
  const StudentHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 110),
          children: [
            const _HomeHeader(),
            const SizedBox(height: 26),
            const _WelcomeCard(),
            const SizedBox(height: 28),
            const _SectionTitle(
                title: 'Continue learning', action: 'My courses'),
            const SizedBox(height: 14),
            const _ProgressCourseCard(),
            const SizedBox(height: 30),
            const _SectionTitle(
                title: 'Recommended for you', action: 'See all'),
            const SizedBox(height: 14),
            SizedBox(
              height: 230,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: const [
                  _CourseCard(
                      title: 'Storytelling for Presentations',
                      category: 'Communication',
                      color: Color(0xFF625674),
                      price: '₹5,999'),
                  SizedBox(width: 13),
                  _CourseCard(
                      title: 'Leading Small Teams',
                      category: 'Leadership',
                      color: Color(0xFFD8BA6F),
                      price: '₹7,999'),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: const _BottomNav(),
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader();

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(
                  color: Color(0xFF18392B), shape: BoxShape.circle),
              child: const Icon(Icons.auto_graph_rounded,
                  color: Color(0xFFF5EBDD), size: 20)),
          const SizedBox(width: 10),
          const Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('NORTHSTAR',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1)),
                Text('LEARNING',
                    style: TextStyle(
                        fontSize: 8,
                        color: Color(0xFF7C867F),
                        letterSpacing: 1.6))
              ])),
          _roundButton(Icons.search_rounded),
          const SizedBox(width: 8),
          _roundButton(Icons.notifications_none_rounded, badge: true),
        ],
      );

  static Widget _roundButton(IconData icon, {bool badge = false}) =>
      Stack(children: [
        Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFE1E3DE)),
                shape: BoxShape.circle),
            child: Icon(icon, size: 19, color: const Color(0xFF334039))),
        if (badge)
          Positioned(
              right: 7,
              top: 7,
              child: Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                      color: Color(0xFFEF8354), shape: BoxShape.circle)))
      ]);
}

class _WelcomeCard extends StatelessWidget {
  const _WelcomeCard();

  @override
  Widget build(BuildContext context) => Container(
        height: 180,
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
            color: const Color(0xFF18392B),
            borderRadius: BorderRadius.circular(18)),
        child: Stack(children: [
          Positioned(
              right: -55,
              top: -75,
              child: Container(
                  width: 190,
                  height: 190,
                  decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: Colors.white.withValues(alpha: .12),
                          width: 22)))),
          Positioned(
              right: 38,
              bottom: -85,
              child: Container(
                  width: 150,
                  height: 150,
                  decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: const Color(0xFFEF8354).withValues(alpha: .28),
                          width: 18)))),
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('GOOD MORNING, MIRA',
                style: TextStyle(
                    color: Color(0xFF9DB4A7),
                    fontSize: 9,
                    letterSpacing: 1.3,
                    fontWeight: FontWeight.w700)),
            SizedBox(height: 11),
            Text('What will you\nlearn today?',
                style: TextStyle(
                    color: Colors.white,
                    fontFamily: 'serif',
                    fontSize: 29,
                    height: 1.04,
                    fontWeight: FontWeight.w500)),
            Spacer(),
            Row(children: [
              Icon(Icons.local_fire_department_rounded,
                  color: Color(0xFFEF8354), size: 18),
              SizedBox(width: 6),
              Text('7 day learning streak',
                  style: TextStyle(
                      color: Color(0xFFE0E8E3),
                      fontSize: 10,
                      fontWeight: FontWeight.w600))
            ])
          ]),
        ]),
      );
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.action});
  final String title;
  final String action;

  @override
  Widget build(BuildContext context) =>
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(title,
            style: const TextStyle(
                fontFamily: 'serif',
                fontSize: 21,
                fontWeight: FontWeight.w600)),
        Text(action,
            style: const TextStyle(
                color: Color(0xFFBE5D39),
                fontSize: 10,
                fontWeight: FontWeight.w800))
      ]);
}

class _ProgressCourseCard extends StatelessWidget {
  const _ProgressCourseCard();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFE6E5DF)),
            borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          Container(
              width: 88,
              height: 108,
              decoration: BoxDecoration(
                  color: const Color(0xFFD67650),
                  borderRadius: BorderRadius.circular(9)),
              child: const Stack(children: [
                Center(
                    child: Icon(Icons.track_changes_rounded,
                        size: 43, color: Color(0xFFFFD3C0))),
                Positioned(
                    left: 10,
                    bottom: 11,
                    child: Text('PRODUCT\nTHINKING',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 8,
                            height: 1.15,
                            fontWeight: FontWeight.w800)))
              ])),
          const SizedBox(width: 14),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                const Text('Product Thinking Foundations',
                    style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        height: 1.25)),
                const SizedBox(height: 7),
                const Text('Module 2 · Choosing what matters',
                    style: TextStyle(color: Color(0xFF7E8781), fontSize: 9)),
                const SizedBox(height: 16),
                ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: const LinearProgressIndicator(
                        value: .68,
                        minHeight: 5,
                        color: Color(0xFFEF8354),
                        backgroundColor: Color(0xFFE9EAE6))),
                const SizedBox(height: 7),
                const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('68% complete',
                          style:
                              TextStyle(color: Color(0xFF6F7972), fontSize: 8)),
                      Text('Continue →',
                          style: TextStyle(
                              color: Color(0xFF18392B),
                              fontSize: 9,
                              fontWeight: FontWeight.w800))
                    ])
              ]))
        ]),
      );
}

class _CourseCard extends StatelessWidget {
  const _CourseCard(
      {required this.title,
      required this.category,
      required this.color,
      required this.price});
  final String title;
  final String category;
  final Color color;
  final String price;

  @override
  Widget build(BuildContext context) => SizedBox(
      width: 210,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
            height: 125,
            decoration: BoxDecoration(
                color: color, borderRadius: BorderRadius.circular(12)),
            child: Stack(children: [
              Positioned(
                  right: -26,
                  bottom: -45,
                  child: Container(
                      width: 125,
                      height: 125,
                      decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: Colors.white.withValues(alpha: .28))))),
              const Center(
                  child: Icon(Icons.all_inclusive_rounded,
                      color: Colors.white70, size: 48)),
              Positioned(
                  left: 12,
                  top: 11,
                  child: Text(category.toUpperCase(),
                      style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 8,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1)))
            ])),
        const SizedBox(height: 11),
        Text(title,
            maxLines: 2,
            style: const TextStyle(
                fontFamily: 'serif',
                fontWeight: FontWeight.w600,
                fontSize: 15,
                height: 1.2)),
        const SizedBox(height: 7),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(price,
              style:
                  const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
          const Row(children: [
            Icon(Icons.star_rounded, size: 13, color: Color(0xFFD68E27)),
            Text(' 4.9',
                style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700))
          ])
        ])
      ]));
}

class _BottomNav extends StatelessWidget {
  const _BottomNav();

  @override
  Widget build(BuildContext context) => Container(
      height: 76,
      decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE5E7E3)))),
      child: const Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavItem(icon: Icons.home_rounded, label: 'Home', active: true),
            _NavItem(icon: Icons.grid_view_rounded, label: 'Explore'),
            _NavItem(
                icon: Icons.play_circle_outline_rounded, label: 'My courses'),
            _NavItem(icon: Icons.person_outline_rounded, label: 'Profile'),
          ]));
}

class _NavItem extends StatelessWidget {
  const _NavItem(
      {required this.icon, required this.label, this.active = false});
  final IconData icon;
  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) => SizedBox(
      width: 70,
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon,
            size: 21,
            color: active ? const Color(0xFF18392B) : const Color(0xFF98A09B)),
        const SizedBox(height: 4),
        Text(label,
            style: TextStyle(
                fontSize: 8,
                fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                color:
                    active ? const Color(0xFF18392B) : const Color(0xFF98A09B)))
      ]));
}
