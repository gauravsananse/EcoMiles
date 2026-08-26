class TransportIntelligenceService {
  /**
   * Generates city-wide aggregate transport analytics and heatmaps
   */
  getCityNetworkAnalytics() {
    return {
      cityName: 'Pune / Pimpri-Chinchwad Smart City Corridor',
      totalActiveUsers: 14850,
      totalJourneysTracked: 184200,
      totalCo2AvoidedTonnes: 142.8,
      totalActiveKmTraveled: 689400,

      // Modal Split Distribution (%)
      modalSplit: [
        { mode: 'WALKING', percentage: 34, trips: 62628, color: '#10b981', label: 'Walking (Active)' },
        { mode: 'PUBLIC_TRANSIT', percentage: 36, trips: 66312, color: '#3b82f6', label: 'Bus & Metro' },
        { mode: 'CYCLING', percentage: 18, trips: 33156, color: '#f59e0b', label: 'Cycling (Active)' },
        { mode: 'EV_MOBILITY', percentage: 9, trips: 16578, color: '#059669', label: 'Electric Vehicles' },
        { mode: 'ICE_CARS', percentage: 3, trips: 5526, color: '#ef4444', label: 'Fossil Fuel Cars' },
      ],

      // City Transport Corridors & Demand Heatmap
      corridors: [
        {
          id: 'corridor-1',
          name: 'University Road ↔ Tech Park Corridor',
          demandLevel: 'HIGH',
          statusColor: '#ef4444', // Red
          dailyUsers: 12400,
          primaryModes: ['Bus', 'Walking', 'Metro'],
          peakHours: '08:00 AM – 10:30 AM',
          cyclingShare: '22%',
          congestionIndex: 78,
          description: 'High commuter density with massive multimodal mode switching at central metro interchange.',
        },
        {
          id: 'corridor-2',
          name: 'Hostel Sector ↔ North Campus Greenway',
          demandLevel: 'MEDIUM',
          statusColor: '#f59e0b', // Orange
          dailyUsers: 5800,
          primaryModes: ['Walking', 'Cycling'],
          peakHours: '07:30 AM – 09:15 AM, 05:00 PM – 07:30 PM',
          cyclingShare: '46%',
          congestionIndex: 35,
          description: 'High micro-mobility & pedestrian usage with strong potential for expanded dedicated bicycle infrastructure.',
        },
        {
          id: 'corridor-3',
          name: 'Old City Market ↔ Railway Station Link',
          demandLevel: 'HIGH',
          statusColor: '#ef4444', // Red
          dailyUsers: 9200,
          primaryModes: ['Walking', 'Bus'],
          peakHours: '09:00 AM – 08:00 PM',
          cyclingShare: '14%',
          congestionIndex: 84,
          description: 'Heavy pedestrian density with narrow sidewalks causing pedestrian-vehicle friction.',
        },
        {
          id: 'corridor-4',
          name: 'South Ring Road Feeder',
          demandLevel: 'LOW',
          statusColor: '#10b981', // Green
          dailyUsers: 2400,
          primaryModes: ['EV', 'Cycling'],
          peakHours: '10:00 AM – 04:00 PM',
          cyclingShare: '28%',
          congestionIndex: 20,
          description: 'Smooth green corridor with low congestion and growing EV adoption.',
        },
      ],

      // AI Urban Planning Recommendations
      aiRecommendations: [
        {
          id: 'rec-1',
          priority: 'URGENT',
          badge: 'Infrastructure',
          title: 'Deploy Dedicated Protected Bike Lane on North Campus Road',
          evidence: '4,500 daily cyclists tracked sharing lanes with motorized traffic between 8-10 AM.',
          impact: 'Reduces cyclist accident risk by 68% and boosts active travel by +25%.',
        },
        {
          id: 'rec-2',
          priority: 'HIGH',
          badge: 'Transit Frequency',
          title: 'Increase Electric Bus 204 Frequency by 30% during Morning Peak',
          evidence: 'Bus dwell times at Station Gate 4 exceed capacity by 140% during 8:15–9:30 AM.',
          impact: 'Cuts commuter wait times from 16 min to 8 min, shifting ~450 daily car trips to transit.',
        },
        {
          id: 'rec-3',
          priority: 'MEDIUM',
          badge: 'First/Last Mile',
          title: 'Install Shared E-Bike Docks at Sector 14 Metro Hub',
          evidence: '84% of commuters walk >1.1 km to reach transit without intermediate feeder options.',
          impact: 'Closes the first-mile transit desert and reduces short private vehicle hops.',
        },
        {
          id: 'rec-4',
          priority: 'OPPORTUNITY',
          badge: 'Pedestrian Safety',
          title: 'Widen Walkways & Add Shaded Trees on Market Station Link',
          evidence: 'Over 9,000 pedestrians walk this 800m corridor in peak heat hours.',
          impact: 'Encourages active walking while improving thermal comfort and pedestrian safety.',
        },
      ],
    };
  }
}

module.exports = new TransportIntelligenceService();
